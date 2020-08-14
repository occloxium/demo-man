const chokidar = require("chokidar");
const p = require("path");
const fs = require("fs");
const logger = require("@zoomoid/log");
const { volume } = require("../index.js");
/**
 * Volume path to watch
 *
 * General guidelines for using this watchdog:
 * We listen to all changes in 2 layers of depth, i.e., we only get notified for changes to the relative root
 * and one layer below. This enables us to group tracks together to albums, as we can create directories and
 * watch for file changes inside the new directories.
 * Newly created directories are treated as albums being created.
 * Files created inside these directories are treated as tracks being created.
 *
 * The same applies to deletion of said directories/files.
 *
 * Hierarchy:
 *
 * ./ (relative root; determined by "VOLUME")
 * |- namespace
 *    |- track1.mp3
 *    |- track2.mp3
 *    |- track3.mp3
 * |- namespace
 *    |- track1.mp3
 *    |- track2.mp3
 * |- namespace
 *
 * This is a valid file tree for our example watchdog */

module.exports = function () {
  /** mp3 watcher */
  chokidar
    .watch(`${volume}/[a-zA-Z0-9]*/*.mp3`, {
      cwd: `${volume}`,
      ignoreInitial: true,
      persistent: true,
      atomic: true,
      usePolling: true,
      depth: 2,
      awaitWriteFinish: {
        stabilityThreshold: 3000,
        pollInterval: 1000,
      },
    })
    .on("add", async (path) => {
      try {
        logger.info(
          "File added",
          "file",
          path,
          "timestamp",
          new Date().toLocaleString("de-DE")
        );
        const reducedFilename = path.replace(`${volume}/`, ""); // strips the volume mount prefix from the filename
        let track = await readMetadata(reducedFilename);
        await postTrackToAPI(track);
      } catch (err) {
        logger.error(
          "Received error from API server",
          "event",
          "add",
          "path",
          path,
          "error",
          err
        );
        logger.info("Reverting changes to file system", "path", path);
        fs.unlink(path, (err) => {
          logger.error("I/O Error on unlink. Exiting...", "error", err);
          process.exit(1);
        });
      }
    })
    .on("unlink", async (path) => {
      const reducedFilename = path.replace(`${volume}/`, ""); // strips the volume mount prefix from the filename
      logger.info(
        "File removed",
        "file",
        reducedFilename,
        "time",
        new Date().toLocaleString("de-DE")
      );
      // API Server querys for full path on delete request
      try {
        await removeTrackFromAPI(reducedFilename);
      } catch (err) {
        logger.error(
          "Received error from API server. Manual assessment required",
          "event",
          "unlink",
          "path",
          path,
          "error",
          err
        );
      }
    });

  /** namespace watcher */
  chokidar
    .watch(`${volume}/`, {
      cwd: `${volume}`,
      ignored: [/(^|[/\\])\../, "private-keys-v1.d"], // exclude some FileZilla bullshit directories
      ignoreInitial: true,
      persistent: true,
      atomic: true,
      usePolling: true,
      depth: 1,
    })
    .on("addDir", async (path) => {
      try {
        if (path == `${volume}/`) {
          logger.info("Skipping docker volume mount event", "directory", path);
          return;
        }
        logger.info(
          "Directory added",
          "directory",
          path,
          "timestamp",
          new Date().toLocaleString("de-DE")
        );
        let namespace = p.basename(path);
        await postNamespaceToAPI(namespace);
      } catch (err) {
        logger.error(
          "Received error from API server",
          "event",
          "addDir",
          "path",
          path,
          "error",
          err
        );
        logger.info("Reverting changes to file system", "path", path);
        fs.unlink(path, (err) => {
          logger.error("I/O Error on unlink. Exiting...", "error", err);
          process.exit(1);
        });
      }
    })
    .on("unlinkDir", async (path) => {
      const reducedFilename = path.replace(`${volume}/`, ""); // strips the volume mount prefix from the filename
      logger.info(
        "Directory removed",
        "directory",
        reducedFilename,
        "time",
        new Date().toLocaleString("de-DE")
      );
      // API Server querys for full path on delete request
      try {
        await removeNamespaceFromAPI(reducedFilename);
      } catch (err) {
        logger.error(
          "Received error from API server. Manual assessment required.",
          "event",
          "unlinkDir",
          "error",
          err
        );
      }
    });

  /** metadata watcher */
  chokidar.watch(`${volume}/[A-Za-z0-9]*/metadata.json`, {
    cwd: `${volume}`,
    ignoreInitial: true,
    persistent: true,
    atomic: true,
    usePolling: true,
    depth: 2,
    awaitWriteFinish: {
      stabilityThreshold: 3000,
      pollInterval: 1000,
    },
  });

  /**
   * Garbage collector removes any files and directories created in the process of SFTP handshakes by FileZilla
   */
  chokidar
    .watch([".cache", ".gnupg", "private-keys-v1.d"], { cwd: `${volume}` })
    .on("addDir", async (path) => {
      logger.info("Cleaning up trash directories", "directory", path);
      fs.rmdir(path, { recursive: true }, (err) => {
        if (err) {
          logger.error("Error on rmdir w/ recursive option", "error", err);
          return;
        }
        logger.info("Finish cleanup round", "directory", path);
      });
    });
};