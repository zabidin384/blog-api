import ImageKit from "imagekit";
import postModel from "../models/post.model.js";
import userModel from "../models/user.model.js";
import mongoose from "mongoose";

export const getPosts = async (req, res) => {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 2;

	const query = {};

	const cat = req.query.cat;
	const search = req.query.search;
	const author = req.query.author;
	const sort = req.query.sort;
	const featured = req.query.featured;

	if (cat) query.category = cat;
	if (search) query.title = { $regex: search, $options: "i" };

	if (author) {
		const user = await userModel.findOne({ username: author }).select("_id");
		if (!user) return res.status(404).json("No post found!");
		query.user = user._id;
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

	const totalPosts = await postModel.countDocuments();
	const hasMore = page * limit < totalPosts;

	res.status(200).json({ posts, hasMore });
};

export const getPost = async (req, res) => {
	const post = await postModel.findOne({ slug: req.params.slug }).populate("user", "username img");
	res.status(200).json(post);
};

export const createPost = async (req, res) => {
	const clerkUserId = req.auth.userId;
	if (!clerkUserId) return res.status(401).json("User is not authenticated!");

	const user = await userModel.findOne({ clerkUserId });
	if (!user) return res.status(404).json("User is not found!");

	let slug = req.body.title.replace(/ /g, "-").toLowerCase();
	let existingPost = await postModel.findOne({ slug });

	let counter = 2;
	while (existingPost) {
		slug = `${slug}-${counter}`;
		existingPost = await postModel.findOne({ slug });
		counter++;
	}

	const newPost = new postModel({ user: user._id, slug, ...req.body });
	const post = await newPost.save();
	res.status(201).json(post);
};

export const deletePost = async (req, res) => {
	const clerkUserId = req.auth.userId;
	if (!clerkUserId) return res.status(401).json("User is not authenticated!");

	// Admin
	const role = req.auth.sessionClaims?.metadata?.role || "user";

	if (role === "admin") {
		await postModel.findByIdAndDelete(req.params.id);
		return res.status(200).json("Post has been deleted successfully!");
	}

	// User
	const user = await userModel.findOne({ clerkUserId });
	if (!user) return res.status(404).json("User is not found!");

	const deletedPost = await postModel.findByIdAndDelete({ _id: req.params.id, user: user._id });
	if (!deletedPost) return res.status(403).json("You can only delete your post!");

	res.status(200).json("Post has been deleted successfully!");
};

export const featurePost = async (req, res) => {
	const postId = req.body.postId;
	const clerkUserId = req.auth.userId;
	if (!clerkUserId) return res.status(401).json("User is not authenticated!");

	const role = req.auth.sessionClaims?.metadata?.role || "user";
	if (role !== "admin") return res.status(403).json("You are not an admin!");

	const post = await postModel.findById(postId);
	if (!post) return res.status(404).json("Post is not found!");

	const isFeatured = post.isFeatured;
	const updatedPost = await postModel.findByIdAndUpdate(postId, { isFeatured: !isFeatured }, { new: true });

	res.status(200).json(updatedPost);
};

const imagekit = new ImageKit({
	urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
	publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
	privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

export const uploadAuth = async (req, res) => {
	const { token, expire, signature } = imagekit.getAuthenticationParameters();
	res.send({ token, expire, signature, publicKey: process.env.IMAGEKIT_PUBLIC_KEY });
};

export const getSuggestions = async (req, res) => {
	const { category, currentPostId } = req.query;

	if (!mongoose.Types.ObjectId.isValid(currentPostId)) {
		return res.status(400).json({ message: "Invalid post id" });
	}

	try {
		let suggestedPosts = await postModel.aggregate([
			{ $match: { category: category, _id: { $ne: new mongoose.Types.ObjectId(currentPostId) } } },
			{ $sample: { size: 4 } },
			{
				$lookup: {
					from: "users",
					localField: "user",
					foreignField: "_id",
					as: "user",
				},
			},
			{ $unwind: "$user" },
		]);

		if (suggestedPosts.length < 4) {
			const excludedIds = suggestedPosts.map((p) => p._id);
			excludedIds.push(new mongoose.Types.ObjectId(currentPostId));

			const additionalPosts = await postModel.aggregate([
				{ $match: { _id: { $not: { $in: excludedIds } } } },
				{ $sample: { size: 4 - suggestedPosts.length } },
				{
					$lookup: {
						from: "users",
						localField: "user",
						foreignField: "_id",
						as: "user",
					},
				},
				{ $unwind: "$user" },
			]);

			suggestedPosts = [...suggestedPosts, ...additionalPosts];
		}

		res.status(200).json(suggestedPosts);
	} catch (err) {
		res.status(500).json(err);
	}
};
