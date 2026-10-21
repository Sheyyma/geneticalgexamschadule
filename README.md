# SınavPlan

Fırat Üniversitesi Mühendislik Fakültesi için genetik algoritma destekli sınav haftası planlama prototipi.

## Çalıştırma

Bu proje bağımlılık kurulumu gerektirmez. Klasörde bir yerel HTTP sunucusu başlatın:

```powershell
python -m http.server 5173
```

Ardından `http://localhost:5173` adresini açın. Node.js kuruluysa `npm test` ile algoritma testlerini çalıştırabilirsiniz. ES modülleri kullandığı için `index.html` dosyasını doğrudan `file://` ile açmak yerine yerel sunucu kullanın.

## Kullanım

İlk açılışta **temsili örnek veriler** gösterilir. Gerçek kayıtlarla başlamak için ana ekrandaki **Örnek verileri temizle** düğmesine basın. Memur, Hocalar ve Asistanlar ekranında personel havuzunu kurar; Dersler ekranında her dersi bir hocaya bağlar; Derslikler ekranında kapasiteyi girer. Planlama Ayarları ekranında sınav haftasının pazartesi tarihini, uygun gün ve saatleri ve genetik algoritma parametrelerini belirler. Tatil günlerini uygun günlerden çıkarır. Program Oluştur düğmesiyle sınavların gün, saat, derslik ve gözetmen asistan atamalarını üretir. Program CSV olarak indirilebilir.

Veriler tarayıcının `localStorage` alanında tutulur; sunucuya veya ortak veritabanına yazılmaz. Aynı çakışma grubu, hoca, gözetmen asistan veya derslik için örtüşen sınavlar ve kapasite aşımı zorunlu ihlal sayılır. Günlük üçten fazla sınav ve 30 dakikadan kısa ara esnek ceza oluşturur. Arayüz, bir çözümde zorunlu ihlal kalmışsa bunu açıkça gösterir; algoritma her veri kümesi için sıfır ihlali garanti etmez.

Bu sürüm bir ön yüz prototipidir. Kimlik doğrulama, çok kullanıcılı veri yönetimi ve Python/Flask servis entegrasyonu henüz yoktur.
