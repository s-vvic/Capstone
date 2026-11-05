import { Navigate, Outlet } from "react-router-dom";
import { getAccessToken } from "../storage/authStorage";

function ProtectedRoute() {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
