import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActionPermissionV1, UserPreferencesV1 } from "@cairvia/schemas";
import { api } from "../api";

export function ControlPage() {
  const client = useQueryClient();
  const prefs = useQuery({
    queryKey: ["preferences"],
    queryFn: () => api<{ preferences: UserPreferencesV1 }>("/preferences")
  });
  const permissions = useQuery({
    queryKey: ["permissions"],
    queryFn: () => api<{ permissions: ActionPermissionV1[] }>("/permissions")
  });
  const save = useMutation({
    mutationFn: (next: UserPreferencesV1) =>
      api("/preferences", { method: "PUT", body: JSON.stringify(next) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["preferences"] })
  });

  const current = prefs.data?.preferences;
  if (!current) {
    return <p>Loading working preferences…</p>;
  }

  function toggle(
    path: (p: UserPreferencesV1) => void
  ): void {
    const next = structuredClone(current);
    path(next);
    save.mutate(next);
  }

  return (
    <div className="timeline">
      <article className="card">
        <h2>Working preferences</h2>
        <label className="pref">
          <input
            type="checkbox"
            checked={current.communication.conciseResponses}
            onChange={(e) =>
              toggle((p) => {
                p.communication.conciseResponses = e.target.checked;
              })
            }
          />
          Concise responses
        </label>
        <label className="pref">
          <input
            type="checkbox"
            checked={current.execution.oneActionAtATime}
            onChange={(e) =>
              toggle((p) => {
                p.execution.oneActionAtATime = e.target.checked;
              })
            }
          />
          One action at a time
        </label>
        <label className="pref">
          <input
            type="checkbox"
            checked={current.recovery.keepResumeState}
            onChange={(e) =>
              toggle((p) => {
                p.recovery.keepResumeState = e.target.checked;
              })
            }
          />
          Keep resume state
        </label>
        <label className="pref">
          <input
            type="checkbox"
            checked={current.control.askBeforeConsequentialActions}
            onChange={(e) =>
              toggle((p) => {
                p.control.askBeforeConsequentialActions = e.target.checked;
              })
            }
          />
          Ask before consequential actions
        </label>
        <label className="pref">
          <input
            type="checkbox"
            checked={current.reducedMotion}
            onChange={(e) =>
              toggle((p) => {
                p.reducedMotion = e.target.checked;
              })
            }
          />
          Reduced motion
        </label>
      </article>
      <article className="card">
        <h2>Permissions</h2>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Risk</th>
              <th>Effect</th>
            </tr>
          </thead>
          <tbody>
            {(permissions.data?.permissions ?? []).map((row) => (
              <tr key={row.actionId}>
                <td>{row.actionId}</td>
                <td>{row.risk}</td>
                <td>{row.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>MEDIUM and HIGH actions cannot execute in Phase 1.</p>
      </article>
    </div>
  );
}
