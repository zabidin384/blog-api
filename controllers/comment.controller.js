import commentModel from "../models/comment.model.js";
import userModel from "../models/user.model.js";

export const getPostComments = async (req, res) => {
	const comments = await commentModel.find({ post: req.params.postId }).populate("user", "username img").sort({ createdAt: -1 });

	res.status(200).json(comments);
};

export const addComment = async (req, res) => {
	const clerkUserId = req.auth.userId;
	const postId = req.params.postId;

	if (!clerkUserId) return res.status(401).json("User is not authenticated!");

	const user = await userModel.findOne({ clerkUserId });
	const newComment = new commentModel({ ...req.body, user: user._id, post: postId });
	const savedComment = await newComment.save();

	setTimeout(() => {
		res.status(201).json(savedComment);
	}, 3000);
};

export const deleteComment = async (req, res) => {
	const id = req.params.id;
	const clerkUserId = req.auth.userId;
	if (!clerkUserId) return res.status(401).json("User is not authenticated!");

	// Admin
	const role = req.auth.sessionClaims?.metadata?.role || "user";

	if (role === "admin") {
		await commentModel.findByIdAndDelete(req.params.id);
		return res.status(200).json("Comment has been deleted successfully!");
	}

	// User
	const user = userModel.findOne({ clerkUserId });
	const deletedComment = await commentModel.findOneAndDelete({ _id: id, user: user._id });
	if (!deletedComment) return res.status(403).json("You can only delete your comment!");

	res.status(200).json("Comment has been deleted successfully!");
};
