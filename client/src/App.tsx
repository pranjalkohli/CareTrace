// CareTrace clinical editorial system: the app shell keeps three safety pillars visible and themeable.
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/404" component={NotFound} />
      {/* CareTrace owns the shell for every product path; Home selects the page from the current location. */}
      <Route component={Home} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster position="top-right" />
        <Router />
      </TooltipProvider>
    </ErrorBoundary>
  );
}
