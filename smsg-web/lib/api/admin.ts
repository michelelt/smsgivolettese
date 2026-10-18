// Thin wrappers over the generated client for the super admin area (ADR-063..067).
import type { components, paths } from "./schema";
import { api, call, saveBlob } from "./call";

type S = components["schemas"];
type Q<P extends keyof paths> = paths[P] extends {
  get: { parameters: { query?: infer X } };
}
  ? NonNullable<X>
  : never;

export type UserRole = S["UserInvite"]["role"];
export type UserRow = S["UserItem"];
export type OrgSettings = S["OrgSettings"] & {
  taxCode: string;
  address: string;
};
export type AuditRow = S["AuditEntry"];
export type AuditQuery = Loose<Q<"/audit">>;
type Loose<T> = {
  [K in keyof T]?: K extends "page" | "pageSize" ? number : string;
};

const path = (id: string) => ({ params: { path: { id } } });
// Empty filter inputs mean "no filter".
const compact = <T extends object>(q: T) =>
  Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== "" && v != null),
  ) as T;

// Filters come from <select>s as plain strings; the API validates them.
export const listUsers = (q: Loose<Q<"/users">>) =>
  call(
    api.GET("/users", {
      params: { query: { ...(compact(q) as Q<"/users">), pageSize: 100 } },
    }),
  );
export const inviteUser = (body: S["UserInvite"]) =>
  call(api.POST("/users/invite", { body }));
export const changeRole = (id: string, role: UserRole) =>
  call(api.PATCH("/users/{id}", { ...path(id), body: { role } }));
export const setActive = (id: string, active: boolean) =>
  call(
    active
      ? api.POST("/users/{id}/reactivate", path(id))
      : api.POST("/users/{id}/deactivate", path(id)),
  );
export const resetMfa = (id: string) =>
  call(api.DELETE("/users/{id}/mfa", path(id)));
export const anonymizeUser = (id: string) =>
  call(api.POST("/gdpr/anonymize", { body: { subject: "user", id } }));
export const anonymizeMember = (id: string) =>
  call(api.POST("/gdpr/anonymize", { body: { subject: "member", id } }));
export const exportData = (subject: "member" | "user", id: string) =>
  saveBlob(
    api.GET("/gdpr/export", {
      params: { query: { subject, id } },
      parseAs: "blob",
    }),
    "dati.json",
  );
export const getOrgSettings = () =>
  call(api.GET("/org-settings")) as Promise<OrgSettings>;
export const putOrgSettings = (body: S["OrgSettingsInput"]) =>
  call(api.PUT("/org-settings", { body }));
export const putCounters = (body: S["CountersInput"]) =>
  call(api.PUT("/org-settings/counters", { body }));
export const listAudit = (q: AuditQuery) =>
  call(
    api.GET("/audit", {
      params: { query: { ...(compact(q) as Q<"/audit">), pageSize: 50 } },
    }),
  );
