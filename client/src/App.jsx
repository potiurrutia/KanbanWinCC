import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import AppShell from "./components/AppShell.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import HomePage from "./pages/HomePage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import BoardPage from "./pages/BoardPage.jsx";
import { IconSpinner } from "./components/Icons.jsx";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <IconSpinner className="h-7 w-7 text-slate-300" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppShell>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="t/:teamId" element={<TeamPage />} />
        <Route path="t/:teamId/b/:boardId" element={<BoardPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/*" element={<Protected />} />
    </Routes>
  );
}
