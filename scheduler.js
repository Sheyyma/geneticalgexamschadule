// A chromosome is an array of { slot, room, assistant } assignments, one gene per exam.
// Hard constraints are scored before any preference about distribution.
export function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function overlaps(a, b, durationA, durationB) {
  if (a.date !== b.date) return false;
  const startA = toMinutes(a.time);
  const startB = toMinutes(b.time);
  return startA < startB + durationB && startB < startA + durationA;
}

export function evaluate(chromosome, exams, rooms, slots, assistants) {
  let hard = 0;
  let soft = 0;
  const details = { group: 0, teacher: 0, assistant: 0, room: 0, capacity: 0, daily: 0, adjacent: 0, imbalance: 0 };
  const groupDays = new Map();
  const dayCounts = new Map();

  chromosome.forEach((gene, index) => {
    const exam = exams[index];
    const room = rooms[gene.room];
    const slot = slots[gene.slot];
    dayCounts.set(slot.date, (dayCounts.get(slot.date) || 0) + 1);
    if (exam.students > room.capacity) { hard += 1; details.capacity += 1; }
    const key = `${exam.group.trim().toLocaleLowerCase("tr-TR")}|${slot.date}`;
    if (!groupDays.has(key)) groupDays.set(key, []);
    groupDays.get(key).push({ start: toMinutes(slot.time), end: toMinutes(slot.time) + exam.duration });
  });

  for (let i = 0; i < chromosome.length; i += 1) {
    for (let j = i + 1; j < chromosome.length; j += 1) {
      const first = chromosome[i];
      const second = chromosome[j];
      const slotA = slots[first.slot];
      const slotB = slots[second.slot];
      if (!overlaps(slotA, slotB, exams[i].duration, exams[j].duration)) continue;
      if (exams[i].group.trim().toLocaleLowerCase("tr-TR") === exams[j].group.trim().toLocaleLowerCase("tr-TR")) { hard += 1; details.group += 1; }
      if (exams[i].teacher.trim().toLocaleLowerCase("tr-TR") === exams[j].teacher.trim().toLocaleLowerCase("tr-TR")) { hard += 1; details.teacher += 1; }
      if (first.assistant === second.assistant) { hard += 1; details.assistant += 1; }
      if (first.room === second.room) { hard += 1; details.room += 1; }
    }
  }

  for (const items of groupDays.values()) {
    if (items.length > 2) { details.daily += items.length - 2; soft += (items.length - 2) * 50; }
    items.sort((a, b) => a.start - b.start);
    for (let i = 1; i < items.length; i += 1) {
      if (items[i].start >= items[i - 1].end && items[i].start - items[i - 1].end < 30) {
        details.adjacent += 1;
        soft += 100;
      }
    }
  }
  const activeDays = new Set(slots.map(slot => slot.date)).size;
  const fairLimit = Math.ceil(exams.length / activeDays);
  for (const count of dayCounts.values()) {
    if (count > fairLimit) {
      details.imbalance += count - fairLimit;
      soft += (count - fairLimit) ** 2 * 40;
    }
  }
  // Lexicographic priority: one hard violation outweighs all soft penalties.
  return { hard, soft, score: hard * 1_000_000 + soft, details };
}

function randomGene(exam, rooms, slots, assistants) {
  const fittingRooms = rooms.map((room, index) => room.capacity >= exam.students ? index : -1).filter(index => index >= 0);
  const choices = fittingRooms.length ? fittingRooms : rooms.map((_, index) => index);
  return { slot: Math.floor(Math.random() * slots.length), room: choices[Math.floor(Math.random() * choices.length)], assistant: Math.floor(Math.random() * assistants.length) };
}

function tournament(population) {
  let winner = population[Math.floor(Math.random() * population.length)];
  for (let i = 0; i < 2; i += 1) {
    const contender = population[Math.floor(Math.random() * population.length)];
    if (contender.fitness.score < winner.fitness.score) winner = contender;
  }
  return winner;
}

export function generateSchedule(exams, rooms, slots, assistants, options = {}) {
  if (!exams.length) throw new Error("Önce en az bir ders ekleyin.");
  if (!rooms.length) throw new Error("Önce en az bir derslik ekleyin.");
  if (!assistants.length) throw new Error("Önce en az bir asistan ekleyin.");
  if (!slots.length) throw new Error("Önce en az bir uygun saat seçin.");
  const populationSize = Math.min(300, Math.max(20, Number(options.population) || 80));
  const generations = Math.min(1000, Math.max(20, Number(options.generations) || 250));
  const crossover = Math.min(1, Math.max(0, Number(options.crossover ?? 80) / 100));
  const mutation = Math.min(1, Math.max(0, Number(options.mutation ?? 5) / 100));
  const started = performance.now();
  const makeIndividual = genes => ({ genes, fitness: evaluate(genes, exams, rooms, slots, assistants) });
  let population = Array.from({ length: populationSize }, () => makeIndividual(exams.map(exam => randomGene(exam, rooms, slots, assistants))));
  let best = population.reduce((a, b) => a.fitness.score <= b.fitness.score ? a : b);
  const history = [best.fitness.score];
  let usedGenerations = 0;

  for (let generation = 0; generation < generations; generation += 1) {
    population.sort((a, b) => a.fitness.score - b.fitness.score);
    if (population[0].fitness.score < best.fitness.score) best = population[0];
    usedGenerations = generation + 1;
    if (generation % 10 === 0) history.push(best.fitness.score);
    if (best.fitness.score === 0) break;
    const next = population.slice(0, Math.min(4, population.length));
    while (next.length < populationSize) {
      const first = tournament(population).genes;
      const second = tournament(population).genes;
      const point = Math.floor(Math.random() * exams.length);
      const child = Math.random() < crossover
        ? first.map((gene, index) => ({ ...(index < point ? gene : second[index]) }))
        : first.map(gene => ({ ...gene }));
      child.forEach((gene, index) => {
        if (Math.random() < mutation) child[index] = randomGene(exams[index], rooms, slots, assistants);
      });
      next.push(makeIndividual(child));
    }
    population = next;
  }
  population.sort((a, b) => a.fitness.score - b.fitness.score);
  if (population[0].fitness.score < best.fitness.score) best = population[0];
  // Local improvement is useful once the GA finds a feasible chromosome: it
  // moves exams between days without disturbing room and assistant assignments.
  if (best.fitness.hard === 0) {
    let improved = true;
    for (let pass = 0; pass < 4 && improved; pass += 1) {
      improved = false;
      for (let index = 0; index < exams.length; index += 1) {
        for (let slot = 0; slot < slots.length; slot += 1) {
          if (slot === best.genes[index].slot) continue;
          const genes = best.genes.map(gene => ({ ...gene }));
          genes[index].slot = slot;
          const candidate = makeIndividual(genes);
          if (candidate.fitness.score < best.fitness.score) {
            best = candidate;
            improved = true;
          }
        }
      }
    }
  }
  return { assignments: best.genes, fitness: best.fitness, history, generations: usedGenerations, durationMs: Math.round(performance.now() - started) };
}
