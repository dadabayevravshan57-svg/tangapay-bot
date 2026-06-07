const TelegramBot = require("node-telegram-bot-api");
const BOT_TOKEN = "8647976988:AAHVeiAPhEIyOBLc4IB3rLkahjRo4FqjxbE";
const ADMIN_ID = 903950800;
const COIN_PRICE = 10000;
const DAILY_EARN = 500;
const RETURN_MULT = 2.5;
const CARD_NUMBER = "8600 1234 5678 9012";
const users = {};
const pending = {};
let uc = 1, pc = 1;
const gid = () => "TP-" + String(uc++).padStart(6,"0");
const gpid = () => "PAY-" + String(pc++).padStart(4,"0");
const fmt = n => n.toLocaleString() + " som";
const bot = new TelegramBot(BOT_TOKEN, {polling:true});
const state = {};
const ss = (id,step,data) => { state[id]={step,data:data||{}}; };
const gs = id => state[id] || {step:"idle",data:{}};
const menu = (admin) => ({reply_markup:{keyboard:admin?[["Tolovlar","Userlar"],["Statistika","Xabar"]]:[["Sotib olish","Hisobim"],["Qaytarish","Referal"]],resize_keyboard:true}});

// ── /start handler — ilovadan kelgan summa parametrini qo'llab-quvvatlaydi ──
bot.onText(/\/start(.*)/,async(msg,m)=>{
  const id = msg.from.id;
  const param = m[1] ? m[1].trim() : "";

  // Agar ilovadan pay_XXXXX parametr kelsa
  if(param.startsWith("pay_") && users[id]) {
    const amount = parseInt(param.replace("pay_",""));
    const qty = Math.floor(amount / COIN_PRICE);
    if(!isNaN(amount) && amount >= COIN_PRICE && qty >= 1) {
      ss(id,"buy_method",{qty:qty, total:qty*COIN_PRICE});
      await bot.sendMessage(id,
        `📱 Ilovadan o'tkazildi!\n\n🪙 ${qty} ta tanga\n💰 ${(qty*COIN_PRICE).toLocaleString()} som\n📈 Kunlik daromad: +${(qty*DAILY_EARN).toLocaleString()} som\n\nTo'lov usulini tanlang:`,
        {reply_markup:{inline_keyboard:[
          [{text:"💳 Karta orqali to'lash",callback_data:"pay_card"}],
          [{text:"❌ Bekor",callback_data:"pay_cancel"}]
        ]}}
      );
      return;
    }
  }

  // Oddiy /start — ro'yxatdan o'tgan bo'lsa
  if(users[id]){
    await bot.sendMessage(id,"Xush kelibsiz "+users[id].name+" ID: "+users[id].id,menu(id===ADMIN_ID));
    return;
  }

  // Yangi foydalanuvchi
  ss(id,"reg_name",{ref:param});
  await bot.sendMessage(id,"TangaPay!\n1 tanga = 10000 som\nKunlik 5% = 500 som\n1 oyda 2.5x\n\nIsmingizni yuboring:");
});

bot.on("message",async msg=>{
  const id=msg.from.id,text=msg.text||"";
  const cur=gs(id);const step=cur.step;const data=cur.data;
  const admin=id===ADMIN_ID;
  if(step==="reg_name"){ss(id,"reg_phone",{name:text});await bot.sendMessage(id,"Telefon raqamingiz:");return;}
  if(step==="reg_phone"){
    const u={id:gid(),tgId:id,name:data.name,phone:text,coins:0,earned:0,refCount:0};
    users[id]=u;
    await bot.sendMessage(ADMIN_ID,"Yangi user: "+u.name+" "+u.phone+" "+u.id);
    ss(id,"idle",{});
    await bot.sendMessage(id,"Royxatdan otdingiz! ID: "+u.id+"\nOgohlantirish: daromad kafolatlanmaydi!",menu(false));return;}
  const u=users[id];
  if(!u&&!admin){await bot.sendMessage(id,"Avval /start yozing");return;}
  if(text==="Hisobim"&&u){await bot.sendMessage(id,"Hisobim\nID: "+u.id+"\nTangalar: "+u.coins+" ta\nQiymat: "+(u.coins*COIN_PRICE)+" som\nKunlik: "+(u.coins*DAILY_EARN)+" som");return;}
  if(text==="Sotib olish"){ss(id,"buy_qty",{});await bot.sendMessage(id,"Nechta tanga? (1 tanga = 10,000 som)\nRaqam yuboring:");return;}
  if(step==="buy_qty"){
    const qty=parseInt(text);
    if(isNaN(qty)||qty<1){await bot.sendMessage(id,"Raqam yuboring");return;}
    ss(id,"buy_method",{qty:qty,total:qty*COIN_PRICE});
    await bot.sendMessage(id,`🪙 ${qty} ta tanga = ${(qty*COIN_PRICE).toLocaleString()} som\n📈 Kunlik: +${(qty*DAILY_EARN).toLocaleString()} som\n\nTo'lov usuli:`,{reply_markup:{inline_keyboard:[[{text:"💳 Karta orqali to'lash",callback_data:"pay_card"}],[{text:"❌ Bekor",callback_data:"pay_cancel"}]]}});return;}
  if(step==="buy_cheque"){
    if(msg.photo){
      const pid=gpid();
      const photoId=msg.photo[msg.photo.length-1].file_id;
      pending[pid]={qty:data.qty,total:data.total,method:data.method,userId:u.id,userName:u.name,userTgId:id,cheque:"rasm",photoId:photoId,pid:pid};
      await bot.sendPhoto(ADMIN_ID,photoId,{caption:"💰 Yangi to'lov!\n👤 "+u.name+"\n🪙 "+data.qty+" ta | "+data.total.toLocaleString()+" som\n💳 "+data.method,reply_markup:{inline_keyboard:[[{text:"✅ Tasdiqlash",callback_data:"ok_"+pid},{text:"❌ Rad",callback_data:"no_"+pid}]]}});
      ss(id,"idle",{});
      await bot.sendMessage(id,"✅ Chek yuborildi! Admin tasdiqlaydi.",menu(false));return;}
    if(text){
      const pid=gpid();
      pending[pid]={qty:data.qty,total:data.total,method:data.method,userId:u.id,userName:u.name,userTgId:id,cheque:text,pid:pid};
      await bot.sendMessage(ADMIN_ID,"💰 Yangi to'lov!\n👤 "+u.name+"\n🪙 "+data.qty+" ta | "+data.total.toLocaleString()+" som\n💳 "+data.method+"\nChek: "+text,{reply_markup:{inline_keyboard:[[{text:"✅ Tasdiqlash",callback_data:"ok_"+pid},{text:"❌ Rad",callback_data:"no_"+pid}]]}});
      ss(id,"idle",{});
      await bot.sendMessage(id,"✅ So'rov yuborildi! Admin tasdiqlaydi.",menu(false));return;}}
  if(text==="Qaytarish"&&u){
    if(!u.coins){await bot.sendMessage(id,"❌ Tanga yo'q");return;}
    const returnAmt = u.coins*COIN_PRICE*RETURN_MULT;
    await bot.sendMessage(id,`↩️ Qaytarish\n🪙 ${u.coins} ta tanga\n💰 ${returnAmt.toLocaleString()} som olasiz\n\nTaskdqlaysizmi?`,{reply_markup:{inline_keyboard:[[{text:"✅ Ha",callback_data:"ret_yes"},{text:"❌ Yo'q",callback_data:"ret_no"}]]}});return;}
  if(text==="Referal"&&u){await bot.sendMessage(id,"👥 Referal:\nhttps://t.me/TANGAPAYAPP_BOT?start="+u.id+"\nHar taklif uchun +1000 som!\nTaklif: "+u.refCount+" ta");return;}
  if(admin){
    if(text==="Tolovlar"){const p=Object.values(pending);if(!p.length){await bot.sendMessage(id,"✅ Hamma tasdiqlangan!");return;}for(const x of p){if(x.photoId){await bot.sendPhoto(id,x.photoId,{caption:x.pid+" | "+x.userName+"\n"+x.qty+" ta | "+x.total.toLocaleString()+" som\n"+x.method,reply_markup:{inline_keyboard:[[{text:"✅ Tasdiqlash",callback_data:"ok_"+x.pid},{text:"❌ Rad",callback_data:"no_"+x.pid}]]}})}else{await bot.sendMessage(id,x.pid+" | "+x.userName+"\n"+x.qty+" ta | "+x.total.toLocaleString()+" som\n"+x.method+"\nChek: "+x.cheque,{reply_markup:{inline_keyboard:[[{text:"✅ Tasdiqlash",callback_data:"ok_"+x.pid},{text:"❌ Rad",callback_data:"no_"+x.pid}]]}})}};return;}
    if(text==="Userlar"){const all=Object.values(users);await bot.sendMessage(id,"👥 Foydalanuvchilar: "+all.length+"\n"+all.map(x=>x.id+" | "+x.name+" | "+x.coins+" tanga").join("\n"));return;}
    if(text==="Statistika"){const all=Object.values(users);await bot.sendMessage(id,"📊 Statistika\n👥 Users: "+all.length+"\n🪙 Tangalar: "+all.reduce((s,x)=>s+x.coins,0)+"\n⏳ Kutilmoqda: "+Object.keys(pending).length);return;}
    if(text==="Xabar"){ss(id,"broadcast",{});await bot.sendMessage(id,"📢 Xabar yozing:");return;}
    if(step==="broadcast"){for(const x of Object.values(users))try{await bot.sendMessage(x.tgId,"📢 TangaPay:\n"+text)}catch(e){}
    ss(id,"idle",{});await bot.sendMessage(id,"✅ Yuborildi!",menu(true));return;}}
});

bot.on("callback_query",async q=>{
  const id=q.from.id,d=q.data;
  const u=users[id];
  const cur=gs(id);const data=cur.data;
  await bot.answerCallbackQuery(q.id);
  if(d==="pay_cancel"){ss(id,"idle",{});await bot.sendMessage(id,"❌ Bekor qilindi.",menu(false));return;}
  if(d==="pay_card"){
    ss(id,"buy_cheque",{qty:data.qty,total:data.total,method:"💳 Karta"});
    await bot.sendMessage(id,`💳 Karta: ${CARD_NUMBER}\n💰 ${data.total.toLocaleString()} som o'tkazing.\n\n📎 Chek rasmi yoki tranzaksiya ID yuboring:`);return;}
  if(d.startsWith("ok_")){
    const pid=d.replace("ok_",""),p=pending[pid];
    if(!p)return;
    const pu=users[p.userTgId];
    if(pu)pu.coins+=p.qty;
    delete pending[pid];
    await bot.sendMessage(p.userTgId,`✅ Tasdiqlandi!\n+${p.qty} tanga qo'shildi!\n🪙 Jami: ${pu?pu.coins:p.qty} ta\n📈 Kunlik daromad: +${((pu?pu.coins:p.qty)*DAILY_EARN).toLocaleString()} som`,menu(false));
    try{await bot.editMessageCaption("✅ Tasdiqlandi: "+p.userName+" +"+p.qty+" tanga",{chat_id:id,message_id:q.message.message_id})}catch(e){await bot.editMessageText("✅ Tasdiqlandi: "+p.userName+" +"+p.qty+" tanga",{chat_id:id,message_id:q.message.message_id})}
    return;}
  if(d.startsWith("no_")){
    const pid=d.replace("no_",""),p=pending[pid];
    if(!p)return;
    delete pending[pid];
    await bot.sendMessage(p.userTgId,"❌ To'lovingiz rad etildi. Muammo bo'lsa admin bilan bog'laning.",menu(false));
    try{await bot.editMessageCaption("❌ Rad: "+p.userName,{chat_id:id,message_id:q.message.message_id})}catch(e){await bot.editMessageText("❌ Rad: "+p.userName,{chat_id:id,message_id:q.message.message_id})}
    return;}
  if(d==="ret_yes"&&u){
    const amt=u.coins*COIN_PRICE*RETURN_MULT,c=u.coins;u.coins=0;
    await bot.sendMessage(ADMIN_ID,`↩️ Qaytarish so'rovi!\n👤 ${u.name}\n🪙 ${c} tanga\n💰 ${amt.toLocaleString()} som to'laning`);
    await bot.editMessageText(`✅ So'rov yuborildi!\n💰 ${amt.toLocaleString()} som to'lanadi.`,{chat_id:id,message_id:q.message.message_id});return;}
  if(d==="ret_no"){await bot.editMessageText("❌ Bekor.",{chat_id:id,message_id:q.message.message_id});return;}
});

console.log("✅ TangaPay bot ishga tushdi!");
