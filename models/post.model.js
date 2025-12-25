import { Schema } from "mongoose";
import mongoose from "mongoose";

const postSchema = new Schema(
	{
		title: { type: String, required: true },
		slug: { type: String, required: true, unique: true },
		desc: { type: String },
		category: { type: String, default: "general" },
		content: { type: String, required: true },
		isFeatured: { type: Boolean, default: false },
		visit: { type: Number, default: 0 },
		img: { type: String },
		user: { type: Schema.Types.ObjectId, ref: "User", required: true },
	},
	{ timestamps: true }
);

export default mongoose.model("Post", postSchema);
