FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG REACT_APP_API_ROOT
RUN if [ -n "$REACT_APP_API_ROOT" ]; then \
      REACT_APP_API_ROOT="$REACT_APP_API_ROOT" npm run build; \
    else \
      env -u REACT_APP_API_ROOT npm run build; \
    fi

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
