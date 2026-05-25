import { Router } from "express";
import { roomSchema } from "../utils/validators";
import { store } from "../data";

const router = Router();

router.post("/", (req, res) => {
  const parseResult = roomSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.format() });
  }

  const room = {
    id: store.generateId("room"),
    ...parseResult.data,
    createdAt: new Date().toISOString(),
  };

  store.addRoom(room);
  res.status(201).json(room);
});

router.get("/", (_req, res) => {
  const rooms = store.getRooms();
  res.json(rooms);
});

router.get("/available", (_req, res) => {
  const rooms = store.getRooms();
  const available = rooms.filter((room) => room.availableSlots.length > 0);
  res.json(available);
});

export default router;
