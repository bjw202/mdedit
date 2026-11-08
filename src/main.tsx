import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './dev/m0Probe'; // [임시] M0 측정 — 커밋 금지
// KaTeX 수식 렌더링 스타일시트 (SPEC-PREVIEW-003)
import 'katex/dist/katex.min.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
