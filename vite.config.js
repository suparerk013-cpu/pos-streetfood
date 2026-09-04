import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // เทสต์ที่เรนเดอร์คอมโพเนนต์ไม่ได้ผ่าน transform ของ plugin-react
  // ต้องบอก esbuild เองว่าใช้ JSX runtime อัตโนมัติ ไม่งั้นพังที่ "React is not defined"
  esbuild: { jsx: 'automatic' },
  build: {
    rolldownOptions: {
      output: {
        // แยก Firebase SDK ออกจากโค้ดแอป เบราว์เซอร์จะ cache ไว้ข้ามการ deploy
        // ทำให้อัปเดตแอปครั้งต่อไปโหลดเฉพาะส่วนที่เปลี่ยน
        advancedChunks: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // exceljs โหลดเฉพาะตอนกดปุ่มส่งออก ไม่ต้องดาวน์โหลดตั้งแต่ติดตั้งแอป
        globIgnores: ['**/exceljs*.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'POS หมึกย่าง หอยแมลงภู่',
        short_name: 'POS หมึกย่าง',
        description: 'ระบบขายหน้าร้าน หมึกย่าง หอยแมลงภู่',
        lang: 'th',
        theme_color: '#ea580c',
        background_color: '#fff7ed',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
