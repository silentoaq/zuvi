import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import './index.css'
import App from './App.tsx'

window.Buffer = Buffer

createRoot(document.getElementById('root')!).render(<App />)