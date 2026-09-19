import { describe, expect, it } from "vitest";
import { liveMaterials } from "@/data/catalog";
import type { LiveSnapshot } from "@/data/live";
import { materialTarget } from "./model";

describe("published material references", () => {
  it("preserves the original read scope and revision when passed into a conversation", () => {
    const snapshot = {
      observations: [
        {
          workspaces: {
            items: [
              {
                read_scope: {
                  work_id: "research-work",
                  delegation_id: "file-grant",
                  target_id: "catalog",
                },
                publication_observation: {
                  latest_confirmed_publication: {
                    files: [
                      {
                        workspace_id: "research-data",
                        revision: 7,
                        path: "report/result.json",
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
      work: { items: [] },
    } as unknown as LiveSnapshot;
    const [file] = liveMaterials(snapshot);
    const reference = JSON.parse(JSON.stringify(materialTarget(file)));
    expect(reference).toEqual({
      kind: "artifact",
      id: "research-data:7:report/result.json",
      workspace: "research-data",
      revision: 7,
      path: "report/result.json",
      workId: "research-work",
      delegationId: "file-grant",
      targetId: "catalog",
    });
  });
});
