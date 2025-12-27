import postModel from "../models/post.model.js";
import userModel from "../models/user.model.js";

export const getUserSavedPosts = async (req, res) => {
	try {
		const clerkUserId = req.auth.userId;
		if (!clerkUserId) return res.status(401).json("User is not authenticated!");

		const currentUser = await userModel.findOne({ clerkUserId });
		if (!currentUser) return res.status(404).json("Current user not found!");

		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 2;

		const query = { _id: { $in: currentUser?.savedPosts || [] } };

		const { cat, search, author, sort, featured } = req.query;

		if (cat) query.category = cat;
		if (search) query.title = { $regex: search, $options: "i" };

		if (author) {
			const authorUser = await userModel.findOne({ username: author }).select("_id");
			if (!authorUser) return res.status(404).json("Author not found!");
			query.user = authorUser._id;
		}

		let sortObj = { createdAt: -1 };

		if (sort) {
			switch (sort) {
				case "newest":
					sortObj = { createdAt: -1 };
					break;
				case "oldest":
					sortObj = { createdAt: 1 };
					break;
				case "popular":
					sortObj = { visit: -1 };
					break;
				case "trending":
					sortObj = { visit: -1 };
					query.createdAt = { $gte: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000) };
					break;
				default:
					break;
			}
		}

		if (featured) query.isFeatured = true;

		const posts = await postModel
			.find(query)
			.populate("user", "username")
			.sort(sortObj)
			.limit(limit)
			.skip((page - 1) * limit);

		const totalPosts = await postModel.countDocuments(query);
		const hasMore = page * limit < totalPosts;

		res.status(200).json({ posts, hasMore });
	} catch (error) {
		console.error("Error in getUserSavedPosts: ", error);
		res.status(500).json({
			message: "Error in getUserSavedPosts",
			error: error.message,
		});
	}
};

export const savePost = async (req, res) => {
	const postId = req.body.postId;
	const clerkUserId = req.auth.userId;
	if (!clerkUserId) return res.status(403).json("User is not authenticated!");

	const user = await userModel.findOne({ clerkUserId });

	const isSaved = user.savedPosts.some((p) => p === postId);

	if (!isSaved) await userModel.findByIdAndUpdate(user._id, { $push: { savedPosts: postId } });
	else await userModel.findByIdAndUpdate(user._id, { $pull: { savedPosts: postId } });

	res.status(200).json(isSaved ? "Post unsaved!" : "Post saved!");
};
