import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { SaltCheckPage } from "../salt/SaltCheckPage";
import { DecomposeScreen } from "../screens/DecomposeScreen";
import { LoadScreen } from "../screens/LoadScreen";
import { PublishScreen } from "../screens/PublishScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
import { AppShell } from "./AppShell";
import { SALT_CHECK_ENABLED } from "./config";

// Routes (spec 5.3).
export const routes: RouteObject[] = [
  { path: "/", element: <AppShell step={1}><LoadScreen /></AppShell> },
  { path: "/decompose", element: <AppShell step={2}><DecomposeScreen /></AppShell> },
  { path: "/review", element: <AppShell step={3} wide><ReviewScreen /></AppShell> },
  { path: "/publish", element: <AppShell step={4}><PublishScreen /></AppShell> },
  ...(SALT_CHECK_ENABLED ? [{ path: "/__salt-check", element: <SaltCheckPage /> }] : []),
  { path: "*", element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter(routes);
