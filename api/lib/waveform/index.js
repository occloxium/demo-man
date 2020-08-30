const { ObjectID } = require("mongodb");
const logger = require("@zoomoid/log").v2;
const { guard, wavemanHook, db } = require("../../util/");

const id = ObjectID.createFromHexString;

module.exports = function (router) {
  router
    .route("/:namespace/:track/waveform")
    /**
     * GET a specific waveform for a specific track from the API server
     * :track is supposed to be a string of ObjectId of the track in question
     * :mode has to be either "full" or "small", otherway an error is returned
     * You can also send addition query "color" such that all templated colors get replaced with your color
     */
    .get(async (req, res) => {
      db.get()
        .findOne({
          type: "Waveform",
          track_id: id(req.params.track),
          namespace: req.params.namespace,
        })
        .then((resp) => {
          if (resp) {
            let waveform;
            switch (req.query.mode) {
              case "small":
                waveform = resp.small.replace(/\\/g, "");
                break;
              case "full":
                waveform = resp.full.replace(/\\/g, "");
                break;
              default:
                res.status(405).send("Unsupported mode");
                return;
            }
            let color = req.query.color || "000000";
            waveform = waveform.replace(/{{.color}}/g, `#${color}`);
            res.set({ "Content-Type": "image/svg+xml" }).send(waveform);
          } else {
            logger.warn("Could not find original document", {
              namespace: req.param.namespace,
              "track.id": req.params.track,
            });
            res.status(404).json({message: "Not found"});
          }
        })
        .catch((err) => {
          logger.error("Error while loading waveform", {
            in: "GET /:namespace/:track/waveform/:mode",
            namespace: `${req.params.namespace}`,
            "track.id": `${req.params.track}`,
            error: err,
          });
          res.status(500).json({message: "Interal Server Error"});
        });
    })
    /**
     * for a given track, regenerate waveforms by querying the wave-man again. This might be useful
     * if we change the config maps for the wave-man and do not want to remove the existing track to
     * retrigger the generation
     */
    .patch(guard, async (req, res) => {
      db.get()
        .findOne(
          {
            _id: id(req.params.track),
            type: "Track",
          },
          { mp3: 1, name: 1 }
        )
        .then(({ mp3 }) => {
          if (mp3) {
            return wavemanHook(mp3);
          } else {
            logger.error("Could not find track document by id", {
              "track.id": req.params.track,
            });
            throw new Error("Not found");
          }
        })
        .then((svg) =>
          db.get().updateOne(
            {
              track_id: id(req.params.track),
              type: "Waveform",
            },
            { full: svg.full, small: svg.small }
          )
        )
        .then((resp) => {
          if (resp) {
            logger.info("Successfully redrawn waveform");
            res.status(200).json({
              response: resp,
            });
          } else {
            logger.warn(
              "Could not find waveform by id. Not updating waveform",
              {
                namespace: req.param.namespace,
                "track.id": req.params.track,
              }
            );
          }
        })
        .catch((err) => {
          logger.error("Error while redrawing waveform", {
            error: err,
          });
          res.status(500).json({message: "Interal Server Error"});
        });
    });
};
