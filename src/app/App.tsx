import { Route, Routes } from 'react-router';

function BootstrapHome() {
  return (
    <main>
      <h1>A Town Called Intervale</h1>
      <p>Repository bootstrap complete. Technical Spike implementation has not started.</p>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="*" element={<BootstrapHome />} />
    </Routes>
  );
}
