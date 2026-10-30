import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import './theme.css'
import { installThemeCss } from './model/themes'
installThemeCss()
import { Home } from './Home'
import { Present } from './present/Present'
import { PresenterView } from './present/PresenterView'
import { Editor } from './editor/Editor'
import { Schemas } from './pages/Schemas'
import { SchemaPage } from './pages/SchemaPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/present/:id" element={<Present />} />
        <Route path="/presenter/:id" element={<PresenterView />} />
        <Route path="/edit/:id" element={<Editor />} />
        <Route path="/schemas" element={<Schemas />} />
        <Route path="/schema/:id" element={<SchemaPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
