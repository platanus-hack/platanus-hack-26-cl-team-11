import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/hanken-grotesk';
import '../../design/tokens.css';
import '../../design/ronda.css';
import './app.css';
import { App } from './App';
import markUrl from '../../design/logo/montu-mark.svg';

const icon = document.createElement('link');
icon.rel = 'icon';
icon.type = 'image/svg+xml';
icon.href = markUrl;
document.head.append(icon);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
