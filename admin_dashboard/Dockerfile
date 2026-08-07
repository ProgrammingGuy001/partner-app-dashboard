# Vite dev server, to match the rest of the local stack — the API runs uvicorn
# directly rather than behind a proxy, so the dashboard serves unbuilt too.
# For a production image, build with `npm run build` and serve dist/ from a static
# host; note that VITE_* values are inlined at build time, not read at runtime.
FROM node:22-alpine

WORKDIR /app

# Dependencies first, so editing source does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host binds 0.0.0.0; without it Vite listens on loopback inside the container
# and the published port answers nothing.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
