import AppShell from '../components/AppShell.jsx';
import SettingsPanel from '../components/SettingsPanel.jsx';

export default function Settings() {
  return (
    <AppShell eyebrow="Account" title="Settings">
      <SettingsPanel />
    </AppShell>
  );
}
