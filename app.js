
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/lokasi", async (req, res) => {
    const kota = req.query.kota?.trim();

    if (!kota) {
        return res.status(400).json({
            message: "Nama kota harus diisi"
        });
    }

    const mapTilerKey = process.env.MAPTILER_API_KEY;
    const mapTilerBaseUrl = process.env.MAPTILER_BASE_URL;
    const weatherApiKey = process.env.WEATHERAPI_KEY;

    if (!mapTilerKey || !mapTilerBaseUrl || !weatherApiKey) {
        return res.status(500).json({
            message: "API key atau konfigurasi belum lengkap"
        });
    }

    try {
        // 1. Cari lokasi menggunakan MapTiler
        const query = encodeURIComponent(kota);
        const urlMapTiler =
            `${mapTilerBaseUrl}/${query}.json?key=${mapTilerKey}&limit=5`;

        const responseLokasi = await axios.get(urlMapTiler);
        const features = responseLokasi.data.features;

        if (!features || features.length === 0) {
            return res.status(404).json({
                message: "Kota tidak ditemukan"
            });
        }

        // Ambil hasil kota yang cocok
        const lokasi = features.find(feature =>
            feature.place_type?.includes("place") ||
            feature.place_type?.includes("municipality")
        ) || features[0];

        const koordinat = lokasi.geometry.coordinates;
        const namaKota = lokasi.text || lokasi.matching_text || kota;

        // Cari nama negara dari konteks MapTiler
        const context = lokasi.context || [];
        const negaraContext = context.find(item =>
            item.id?.startsWith("country")
        );

        // 2. Ambil cuaca terkini menggunakan WeatherAPI
        // Menggunakan koordinat MapTiler untuk menghindari
        // kesalahan jika terdapat beberapa kota dengan nama sama.
        const responseCuaca = await axios.get(
            "https://api.weatherapi.com/v1/current.json",
            {
                params: {
                    key: weatherApiKey,
                    q: `${koordinat[1]},${koordinat[0]}`,
                    aqi: "no"
                }
            }
        );

        const dataCuaca = responseCuaca.data;
        const current = dataCuaca.current;
        const lokasiCuaca = dataCuaca.location;

        // 3. Kirim hasil ke frontend
        res.json({
            kota: namaKota,
            negara: negaraContext?.text || lokasiCuaca.country,
            koordinat: koordinat,

            cuaca: {
                suhu: current.temp_c,
                kondisi: current.condition.text,
                ikon: current.condition.icon,
                terasa: current.feelslike_c,
                kelembapan: current.humidity,
                angin: current.wind_kph,
                uv: current.uv
            },

            waktu: lokasiCuaca.localtime,
            terakhir_diperbarui: current.last_updated
        });

    } catch (error) {
    console.error("Status:", error.response?.status);
    console.error("Pesan:", error.response?.data);
    console.error("URL:", error.config?.url);

    res.status(500).json({
        message: "Gagal mengambil data lokasi atau cuaca",
        detail: error.response?.data?.error?.message ||
                error.response?.data?.message ||
                error.message
    });
}

});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);



});