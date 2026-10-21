import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, generateSchedule, overlaps } from "./scheduler.js";

const slots = [
  { date: "2027-01-11", time: "09:00" },
  { date: "2027-01-11", time: "10:00" },
  { date: "2027-01-11", time: "13:00" },
  { date: "2027-01-12", time: "09:00" },
];
const exams = [
  { name: "A", group: "Bilgisayar 2", teacher: "Ayşe", students: 60, duration: 120 },
  { name: "B", group: "Bilgisayar 2", teacher: "Ayşe", students: 40, duration: 90 },
];
const rooms = [{ name: "A1", capacity: 70 }, { name: "A2", capacity: 50 }];
const assistants = [{ name: "Asistan A" }, { name: "Asistan B" }];

test("real exam durations determine overlap, not just matching start times", () => {
  assert.equal(overlaps(slots[0], slots[1], 120, 90), true);
  assert.equal(overlaps(slots[0], slots[2], 120, 90), false);
});

test("hard violations count group, teacher, assistant, room and capacity separately", () => {
  const result = evaluate([{ slot: 0, room: 1, assistant: 0 }, { slot: 1, room: 1, assistant: 0 }], exams, rooms, slots, assistants);
  assert.equal(result.hard, 5);
  assert.deepEqual([result.details.group, result.details.teacher, result.details.assistant, result.details.room, result.details.capacity], [1, 1, 1, 1, 1]);
});

test("genetic search creates a valid schedule for a feasible small dataset", () => {
  const result = generateSchedule(exams, rooms, slots, assistants, { population: 60, generations: 300, crossover: 80, mutation: 15 });
  assert.equal(result.fitness.hard, 0);
  assert.equal(result.assignments.length, exams.length);
});

test("a schedule cannot be generated without an assistant pool", () => {
  assert.throws(() => generateSchedule(exams, rooms, slots, []), /asistan/);
});

test("feasible exams are spread across available days", () => {
  const independent = exams.map((exam, index) => ({ ...exam, group: `Grup ${index}`, teacher: `Hoca ${index}` }));
  const result = generateSchedule(independent, rooms, slots, assistants, { population: 40, generations: 100 });
  const days = result.assignments.map(gene => slots[gene.slot].date);
  assert.equal(new Set(days).size, 2);
});
