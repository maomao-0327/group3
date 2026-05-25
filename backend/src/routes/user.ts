import { Router } from "express";
import { registerSchema } from "../utils/validators";
import { store } from "../data";

const router = Router();

router.post("/register", (req, res) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.format() });
  }

  const id = store.generateId("user");
  const user = {
    id,
    ...parseResult.data,
    createdAt: new Date().toISOString(),
  };

  store.addUser(user);
  res.status(201).json(user);
});

router.get("/", (_req, res) => {
  const users = store.getUsers();
  res.json(users);
});

router.get("/:id", (req, res) => {
  const users = store.getUsers();
  const user = users.find((item) => item.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user);
});

export default router;
