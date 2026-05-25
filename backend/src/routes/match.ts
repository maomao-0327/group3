import { Router } from "express";
import { matchRequestSchema } from "../utils/validators";
import { store } from "../data";
import type { MatchRequest } from "../types";

const router = Router();

router.post("/", (req, res) => {
  const parseResult = matchRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.format() });
  }

  const { studentId, professorId } = parseResult.data;
  const users = store.getUsers();
  const student = users.find((user) => user.id === studentId && user.role === "student");
  const professor = users.find((user) => user.id === professorId && user.role === "professor");

  if (!student || !professor) {
    return res.status(400).json({ error: "Student or professor not found" });
  }

  const matchCandidate = store.findBestMatch(student, professor);
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

router.get("/:id", (req, res) => {
  const matches = store.getMatches();
  const match = matches.find((item) => item.id === req.params.id);
  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }
  res.json(match);
});

export default router;
