# Seekto as a static site: build it, then serve it with nginx.
#   docker build -t seekto . && docker run -p 8080:80 seekto
# Then open http://localhost:8080. Your data still lives in each browser, not on this server.
FROM node:20-alpine AS build
WORKDIR /src
COPY . .
ARG VENDOR_WHISPER=0
RUN node pipeline/build-site.mjs && if [ "$VENDOR_WHISPER" = "1" ]; then node pipeline/vendor-whisper.mjs; fi

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/site /usr/share/nginx/html
