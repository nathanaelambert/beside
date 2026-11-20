import assert from "node:assert/strict";
import { it } from "node:test";
import { cottageConstruction } from "@beside/domain/cottage";
import { execute } from "@beside/domain/model";
import { createSeed } from "@beside/domain/seed";

const at = (seconds: number) =>
  new Date(Date.UTC(2030, 0, 1) + seconds * 1000).toISOString();

it("queues 5, 10 and 15 second builds even when all achievements arrive during the foundation", () => {
  const created = execute(
    createSeed(),
    {
      type: "createActivity",
      actorId: "mosaab",
      templateId: "read-book",
      connectionId: "mn",
      name: "Construction clock",
      description: "",
      subjectIds: [],
      target: 3,
    },
    at(0),
  );
  let db = created.db;
  const activity = () =>
    db.activities.find((row) => row.id === created.entityId)!;
  assert.deepEqual(cottageConstruction(activity(), Date.parse(at(0))), {
    level: 0,
    building: 1,
    seconds: 5,
  });
  for (let i = 1; i <= 3; i++) {
    const planned = execute(
      db,
      {
        type: "createMilestone",
        actorId: "mosaab",
        activityId: created.entityId,
        parentId: null,
        name: `Step ${i}`,
        quantity: 1,
        policy: "open",
        startAt: null,
        endAt: null,
        itemId: null,
      },
      at(i),
    );
    db = execute(
      planned.db,
      {
        type: "recordLog",
        actorId: "mosaab",
        input: {
          authorUserId: "mosaab",
          origin: "manual",
          title: "Done",
          durationMinutes: 0,
          milestoneId: planned.entityId,
          isSuccess: true,
          occurredAt: at(i),
        },
      },
      at(i),
    ).db;
    if (i === 1)
      db = execute(
        db,
        {
          type: "deleteMilestone",
          actorId: "mosaab",
          milestoneId: planned.entityId,
        },
        at(1),
      ).db;
  }
  assert.deepEqual(activity().cottageBuild?.readyAt, {
    base: at(5),
    entrance: at(15),
    finished: at(30),
  });
  assert.deepEqual(cottageConstruction(activity(), Date.parse(at(5))), {
    level: 1,
    building: 2,
    seconds: 10,
  });
  assert.deepEqual(cottageConstruction(activity(), Date.parse(at(15))), {
    level: 2,
    building: 3,
    seconds: 15,
  });
  assert.deepEqual(cottageConstruction(activity(), Date.parse(at(30))), {
    level: 3,
    building: null,
    seconds: 0,
  });
});

it("treats legacy unlocked cottages as immediately built", () => {
  assert.deepEqual(
    cottageConstruction(
      { cottageMilestones: 3, cottageBuild: null },
      Date.parse(at(0)),
    ),
    {
      level: 3,
      building: null,
      seconds: 0,
    },
  );
});
