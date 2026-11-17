import { Badge } from "@/components/ui/badge";
import type { SignedInDeviceType, SignedInSession } from "@/lib/shared/kliv-auth.js";
import { countryName, lastActiveLabel } from "@/lib/signedInDevices";
import { Loader2, Monitor, MonitorSmartphone, Smartphone, Tablet, type LucideIcon } from "lucide-react";

const DEVICE_ICONS: Record<SignedInDeviceType, LucideIcon> = {
  desktop: Monitor,
  phone: Smartphone,
  tablet: Tablet,
  unknown: MonitorSmartphone,
};

/** The member's live sessions, most recently active first, as listSessions() returns them. */
export function SignedInDevices({ sessions, failed }: { sessions: SignedInSession[] | null; failed: boolean }) {
  if (failed) {
    return <p className="text-sm text-muted-foreground">Det gick inte att visa inloggade enheter.</p>;
  }
  if (sessions === null) {
    return <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Laddar inloggade enheter" />;
  }
  return (
    <ul aria-label="Inloggade enheter" className="space-y-3">
      {sessions.map((session, index) => {
        const DeviceIcon = DEVICE_ICONS[session.deviceType];
        return (
          <li key={index} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary">
              <DeviceIcon size={16} aria-hidden="true" data-device-type={session.deviceType} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                {session.device}
                {session.current && <Badge variant="outline">Den här enheten</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">
                {countryName(session.country)} · Senast aktiv {lastActiveLabel(session.lastActiveOn)}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
