import assert from "node:assert/strict";
import { it } from "node:test";
import {
  cottageBuildSettings,
  cottageConstruction,
  queueCottageLevel,
} from "@beside/domain/cottage";
import { execute } from "@beside/domain/model";
import { createSeed } from "@beside/domain/seed";
import { readCottageBuildDurations } from "../src/cottage-build.config.ts";

const at = (seconds: number) =>
  new Date(Date.UTC(2030, 0, 1) + seconds * 1000).toISOString();

it("queues 10, 15 and 20 second builds even when all achievements arrive during the foundation", () => {
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
    seconds: 10,
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
    base: at(10),
    entrance: at(25),
    finished: at(45),
  });
  assert.deepEqual(cottageConstruction(activity(), Date.parse(at(10))), {
    level: 1,
    building: 2,
    seconds: 15,
  });
  assert.deepEqual(cottageConstruction(activity(), Date.parse(at(25))), {
    level: 2,
    building: 3,
    seconds: 20,
  });
  assert.deepEqual(cottageConstruction(activity(), Date.parse(at(45))), {
    level: 3,
    building: null,
    seconds: 0,
  });
});

it("applies changed backend durations only to stages that do not have a deadline", () => {
  const original = { base: 10, entrance: 15, finished: 20 };
  const updated = { base: 12, entrance: 18, finished: 25 };
  const build = cottageBuildSettings(original);
  queueCottageLevel(build, 1, at(0), original);
  queueCottageLevel(build, 2, at(2), original);
  queueCottageLevel(build, 1, at(3), updated);
  queueCottageLevel(build, 2, at(3), updated);
  queueCottageLevel(build, 3, at(3), updated);
  assert.deepEqual(build.seconds, { base: 10, entrance: 15, finished: 25 });
  assert.deepEqual(build.readyAt, {
    base: at(10),
    entrance: at(25),
    finished: at(50),
  });
});

it("validates optional API environment overrides in whole seconds", () => {
  assert.deepEqual(readCottageBuildDurations({}), {
    base: 10,
    entrance: 15,
    finished: 20,
  });
  assert.deepEqual(
    readCottageBuildDurations({ COTTAGE_BUILD_ENTRANCE_SECONDS: "18" }),
    {
      base: 10,
      entrance: 18,
      finished: 20,
    },
  );
  for (const raw of ["", "0", "1.5", "0x10", "3601", "slow"])
    assert.throws(
      () => readCottageBuildDurations({ COTTAGE_BUILD_BASE_SECONDS: raw }),
      /COTTAGE_BUILD_BASE_SECONDS must be a whole number/,
    );
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
