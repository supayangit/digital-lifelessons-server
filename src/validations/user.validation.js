import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  bio: z.string().max(500, "Bio must be at most 500 characters").optional(),
  image: z.string().url("Image must be a valid URL").optional(),
});
