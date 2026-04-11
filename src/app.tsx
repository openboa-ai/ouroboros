import { BootStateScreen } from "./components/boot-state-screen";
import { WorkspaceDashboardScreen } from "./components/workspace-dashboard-screen";
import { useWorkspaceController } from "./hooks/use-workspace-controller";

export function App() {
  const controller = useWorkspaceController();

  if (!controller.state) {
    return (
      <BootStateScreen
        error={controller.bootstrapError}
        onRetry={() => controller.loadBootstrapState()}
      />
    );
  }

  return <WorkspaceDashboardScreen controller={controller} />;
}
