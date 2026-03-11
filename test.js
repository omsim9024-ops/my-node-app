async function f(){
  try {
    try { throw 0; } catch(_e){ }
  } catch(e){ }
}
