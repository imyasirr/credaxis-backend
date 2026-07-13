const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    collection: String,

    documentId: mongoose.Schema.Types.ObjectId,

    action: {
      type: String,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE"
      ],
    },

    oldData: Object,

    newData: Object,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);