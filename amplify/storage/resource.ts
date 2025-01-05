import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
    name: "amplifyTeamDrive",
    access: (allow) => ({
        "public/*": [
            allow.guest.to(["read"]),
            allow.authenticated.to(["read", "write", "delete"]),
        ],
        "embeddings/*": [
            allow.guest.to(["read"]),
            allow.authenticated.to(["read", "write", "delete"]),
        ],
    }),
});
