import { Router } from "express";
import { matchRequestSchema } from "../utils/validators";
import { store } from "../data";
import type { MatchRequest } from "../types";

const router = Router();

function intersectStrings(a: string[], b: string[]) {
  return a.filter((item) => b.includes(item));
}

function intersectSlots(a: { day: string; start: string; end: string }[], b: { day: string; start: string; end: string }[]) {
  return a.filter((slotA) =>
    b.some(
      (slotB) =>
        slotA.day === slotB.day &&
        slotA.start === slotB.start &&
        slotA.end === slotB.end
    )
  );
}

function findRoomForSlot(rooms: any[], slot: { day: string; start: string; end: string }) {
  return rooms.find((room) =>
    room.availableSlots.some(
      (roomSlot: any) =>
        roomSlot.day === slot.day &&
        roomSlot.start === slot.start &&
        roomSlot.end === slot.end
    )
  );
}

router.post("/", (req, res) => {
  const parseResult = matchRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.format() });
  }

  const { studentId, professorId } = parseResult.data;
  const users = store.getUsers();
  const participantA = users.find((user) => user.id === studentId);
  const participantB = users.find((user) => user.id === professorId);

  if (!participantA || !participantB) {
    return res.status(400).json({ error: "参加者が見つかりません" });
  }

  const matchCandidate = store.findBestMatch(participantA, participantB);
  if (!matchCandidate) {
    return res.status(404).json({ error: "No matching room or common availability found" });
  }

  const match: MatchRequest = {
    id: store.generateId("match"),
    studentId,
    professorId,
    roomId: matchCandidate.room.id,
    slot: matchCandidate.slot,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  store.addMatch(match);
  res.status(201).json(match);
});

router.get("/", (_req, res) => {
  const matches = store.getMatches();
  res.json(matches);
});

router.get("/suggestions", (_req, res) => {
  const users = store.getUsers();
  const rooms = store.getRooms();

  const suggestions = users.flatMap((user, index) =>
    users
      .slice(index + 1)
      .map((other) => {
        const sharedGames = intersectStrings(user.games, other.games);
        if (sharedGames.length === 0) return null;

        const commonSlots = intersectSlots(user.availability, other.availability);
        if (commonSlots.length === 0) return null;

        const roomCandidates = commonSlots
          .map((slot) => ({
            slot,
            room: findRoomForSlot(rooms, slot),
          }))
          .filter((item) => item.room !== undefined);

        if (roomCandidates.length === 0) {
          return {
            studentId: user.id,
            professorId: other.id,
            gameOptions: sharedGames,
            availability: commonSlots,
          };
        }

        const firstRoom = roomCandidates[0];
        return {
          studentId: user.id,
          professorId: other.id,
          roomId: firstRoom.room.id,
          gameOptions: sharedGames,
          availability: commonSlots,
        };
      })
      .filter((item): item is { studentId: string; professorId: string; roomId?: string; gameOptions: string[]; availability: { day: string; start: string; end: string }[] } => item !== null)
  );

  res.json(suggestions);
});

router.get("/:id", (req, res) => {
  const matches = store.getMatches();
  const match = matches.find((item) => item.id === req.params.id);
  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }
  res.json(match);
});

export default router;
