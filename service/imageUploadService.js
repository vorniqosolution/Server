const s3 = require("../config/S3.js");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

exports.uploadImageToS3 = async (file) => {
  const key = `images/rooms/${Date.now()}-${file.originalname}`;
  
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  await s3.send(new PutObjectCommand(params));

  // Construct and return the full public URL
  return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

exports.deleteImageFromS3 = async (imageUrl) => {
  try {
    // Extract the 'key' (path) from the full URL
    const url = new URL(imageUrl);
    const key = url.pathname.substring(1); // Remove the leading '/'

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
    };

    await s3.send(new DeleteObjectCommand(params));
    console.log(`Successfully deleted from S3: ${key}`);
  } catch (error) {
    console.error(`Failed to delete from S3: ${imageUrl}`, error);
    // Don't re-throw error, just log it. Deletion failure shouldn't block the whole update.
  }
};