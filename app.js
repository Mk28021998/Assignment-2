const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const nodemon = require("nodemon");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running...");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `INSERT INTO 
            user (name, username, password, gender)
        VALUES(
            '${name}',
            '${username}',
            '${hashedPassword}',
            '${gender}');`;
    if (password.length >= 6) {
      await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username, userId: dbUser.user_id };
      const jwtToken = jwt.sign(payload, "12345");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "12345", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.userId = payload.userId;
        next();
      }
    });
  }
};

//API- 3
app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    let { username } = request;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const userId = await db.get(getUserIdQuery);
    //console.log(userId);
    const getFollowerIdQuery = `SELECT following_user_id FROM follower WHERE following_user_id=${userId.user_id};`;
    const followerIds = await db.all(getFollowerIdQuery);
    console.log(followerIds);
    const getFollowerIdsSimple = followerIds.map((eachIds) => {
      return eachIds.following_user_id;
    });
    //console.log(userId);
    //console.log(`${userId}`);
    const getTweetQuery = `SELECT user.username,tweet.tweet,tweet.date_time AS dateTime
        from user INNER JOIN tweet
        ON user.user_id=tweet.user_id
        WHERE user.user_id IN (${getFollowerIdsSimple})
        ORDER BY tweet.date_time DESC LIMIT 4;`;
    const res = await db.all(getTweetQuery);
    //console.log(res);
    response.send(res);
  }
);

//API-4
app.get("/user/following/", authenticationToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const userId = await db.get(getUserIdQuery);
  //console.log(userId);
  const getFollowersIdQuery = `SELECT following_user_id FROM follower WHERE following_user_id=${userId.user_id};`;
  const followerId = await db.all(getFollowersIdQuery);
  //console.log(followerId);
  const getFollowersId = followerId.map((eachIds) => {
    return eachIds.following_user_id;
  });
  const getFollowersResultQuery = `SELECT name FROM user WHERE user_id IN (${getFollowersId});`;
  const res = await db.all(getFollowersResultQuery);
  response.send(res);
});

//API-5
app.get("/user/followers/", authenticationToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const userId = await db.get(getUserIdQuery);
  //console.log(userId);
  const getFollowersIdQuery = `SELECT follower_user_id FROM follower WHERE follower_user_id=${userId.user_id};`;
  const followerId = await db.all(getFollowersIdQuery);
  //console.log(followerId);
  const getFollowersId = followerId.map((eachIds) => {
    return eachIds.follower_user_id;
  });
  const getFollowersResultQuery = `SELECT name FROM user WHERE user_id IN (${getFollowersId});`;
  const respondResult = await db.all(getFollowersResultQuery);
  response.send(respondResult);
});

//API-6
const convertDbRequestObjectToResponse = (
  tweetData,
  likesCount,
  replyCount
) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};
app.get("/tweets/:tweetId/", authenticationToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const userId = await db.get(getUserIdQuery);
  console.log(userId);
  const getFollowersIdQuery = `SELECT following_user_id FROM follower WHERE follower_user_id=${userId.user_id};`;
  const followerId = await db.all(getFollowersIdQuery);
  console.log(followerId);
  const getFollowingId = followerId.map((eachIds) => {
    return eachIds.following_user_id;
  });
  console.log(getFollowingId);
  //get the tweets made by the user he following
  const getTweetIdQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingId});`;
  const tweetIdsArray = await db.all(getTweetIdQuery);
  const followingTweetIds = tweetIdsArray.map((eachId) => {
    return eachId.tweetId;
  });
  console.log(followingTweetIds);
  if (followingTweetIds.includes(parseInt(tweetId))) {
    const likesCountQuery = `SELECT COUNT(user_id) as likes FROM like WHERE tweetId=${tweetId}`;
    const likesCount = await db.get(likesCountQuery);
    console.log(likesCount);
    const replayCountQuery = `SELECT COUNT(user_id) as replies FROM reply WHERE tweetId=${tweetId}`;
    const replayCount = await db.get(replayCountQuery);
    console.log(likesCount);
    const tweetDateTimeQuery = `SELECT tweet,date_time FROM tweet WHERE tweetId=${tweetId}`;
    const tweetDateTime = await db.get(tweetDateTimeQuery);
    //console.log(tweetDateTime)
    response.send(
      convertDbRequestObjectToResponse(tweetDateTime, likesCount, replayCount)
    );
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API -7
app.get(
  "/tweets/:tweetId/likes/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const getLikeQuery = `SELECT username FROM user
        INNER JOIN like ON user.user_id=like.user_id
        WHERE tweet_id='${tweetId}';`;
    const likedUser = await db.all(getLikeQuery);
    const userArray = likedUser.map((eachUser) => {
      return eachUser.username;
    });
    response.send({ likes: userArray });
  }
);

//API-8
app.get(
  "/tweets/:tweetId/replies/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const getRepliedQuery = `SELECT name,reply FROM user
        INNER JOIN reply ON user.user_id=reply.user_id
        WHERE tweet_id='${tweetId}';`;
    const repliedUser = await db.all(getRepliedQuery);
    response.send({ replies: repliedUser });
  }
);

//API-9
app.get("/user/tweets/", authenticationToken, async (request, response) => {
  const { username } = request;
  const getUserIds = `SELECT user_id FROM user WHERE username='${username}';`;
  const getUserId = await db.get(getUserIds);
  //console.log(getUserId);
  const getTweetQuery = `SELECT tweet,
            COUNT(DISTINCT like_id) AS likes,
            COUNT(DISTINCT reply_id) AS replies,
            date_time AS dateTime
            FROM tweet LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
            LEFT JOIN like ON tweet.tweet_id = like.tweet_id
            WHERE tweet.user_id = ${getUserId}
            GROUP BY tweet.tweet_id;`;
  const tweet = await db.all(getTweetQuery);
  response.send(tweet);
});

//API-10
app.post("/user/tweets/", authenticationToken, async (request, response) => {
  const { tweet } = request.body;
  const { username } = request;
  const getUserIds = `SELECT user_id FROM user WHERE username='${username}';`;
  const getUserId = await db.get(getUserIds);
  const currentDate = new Date().toJSON().substring(0, 19).replace("T", " ");
  //console.log(currentDate);
  const postRequestQuery = `INSERT INTO tweet (tweet,user_id,date_time)
        VALUES('${tweet}', ${getUserId.user_id}, '${currentDate}');`;
  await db.run(postRequestQuery);
  response.send("Created a Tweet");
});

//API-11
app.delete(
  "/tweets/:tweetId/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    //console.log(tweetId);
    const { userId } = request;
    //console.log(userId);
    //const { username } = request;
    //console.log(username);
    const getTheTweetQuery = `SELECT * FROM tweet WHERE user_id='${userId}' AND tweet_id='${tweetId}';`;
    const tweet = await db.get(getTheTweetQuery);
    //console.log(tweet);
    if (tweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id='${tweetId}';`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
