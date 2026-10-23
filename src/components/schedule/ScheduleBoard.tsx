"use client";

import "@bryntum/scheduler/scheduler.css";
import "@bryntum/scheduler/svalbard-light.css";
import "@bryntum/scheduler/fontawesome/css/fontawesome.css";
import "@bryntum/scheduler/fontawesome/css/solid.css";

import { StringHelper, type EventModel, type Model } from "@bryntum/scheduler";
import { BryntumScheduler } from "@bryntum/scheduler-react";
import { useMemo } from "react";
import type { ScheduleData } from "@/lib/views";

export type BoardMove = { jobId: string; milestoneId: string; crewId: string; startsAt: string; endsAt: string };

function money(value: unknown) {
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function ScheduleBoard({
  data,
  start,
  end,
  onMove,
  onSelect,
}: {
  data: ScheduleData;
  start: Date;
  end: Date;
  onMove: (move: BoardMove) => void;
  onSelect: (id: string) => void;
}) {
  // Fresh arrays each time the server data changes, so the scheduler reloads its stores.
  const resources = useMemo(() => data.resources.map((item) => ({ ...item })), [data]);
  const events = useMemo(() => data.events.map((item) => ({ ...item })), [data]);

  // Bookings are whole working days: 09:00 on the first day to 17:00 on the last.
  function moved(record: EventModel) {
    if (!record.startDate || !record.endDate) return;
    const start = new Date(record.startDate);
    start.setHours(9, 0, 0, 0);
    const end = new Date(record.endDate);
    if (end.getHours() === 0 && end.getMinutes() === 0) end.setDate(end.getDate() - 1);
    end.setHours(17, 0, 0, 0);
    if (end <= start) end.setTime(start.getTime() + 8 * 3_600_000);
    onMove({
      jobId: String(record.get("jobId")),
      milestoneId: String(record.get("milestoneId")),
      crewId: String(record.resourceId),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    });
  }

  return (
    <BryntumScheduler
      startDate={start}
      endDate={end}
      viewPreset="dayAndWeek"
      rowHeight={68}
      barMargin={10}
      fillTicks
      snap
      timeResolution={{ unit: "day", increment: 1 }}
      columns={[
        {
          text: "Crew",
          field: "name",
          width: 200,
          renderer: ({ record }: { record: Model }) => ({
            className: "board-crew",
            children: [
              { tag: "b", text: String(record.get("name")) },
              { tag: "small", text: String(record.get("trade")) },
            ],
          }),
        },
      ]}
      resources={resources}
      events={events}
      eventStyle="tonal"
      eventEditFeature={false}
      eventMenuFeature={false}
      scheduleMenuFeature={false}
      cellMenuFeature={false}
      eventDragCreateFeature={false}
      nonWorkingTimeFeature
      eventTooltipFeature={{
        template: ({ eventRecord }: { eventRecord: EventModel }) =>
          StringHelper.xss`<div class="board-tip"><b>${eventRecord.name}</b><div>${eventRecord.get("project")} · ${eventRecord.get("city")}</div><div>${money(
            eventRecord.get("amountUsd"),
          )} · ${eventRecord.get("statusLabel")}</div><div>${eventRecord.get("verificationLabel")}</div></div>`,
      }}
      eventRenderer={({ eventRecord }: { eventRecord: EventModel }) => [
        { tag: "b", className: "board-title", text: eventRecord.name },
        { tag: "small", className: "board-sub", text: `${money(eventRecord.get("amountUsd"))} · ${eventRecord.get("statusLabel")}` },
      ]}
      onAfterEventDrop={({ eventRecords, valid }: { eventRecords: EventModel[]; valid: boolean }) => {
        if (valid && eventRecords[0]) moved(eventRecords[0]);
      }}
      onEventResizeEnd={({ changed, eventRecord }: { changed: boolean; eventRecord: EventModel }) => {
        if (changed) moved(eventRecord);
      }}
      onEventClick={({ eventRecord }: { eventRecord: EventModel }) => onSelect(String(eventRecord.id))}
    />
  );
}
