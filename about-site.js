/* Footer site information only. Personal records and consent stay in their existing modules. */
(()=>{'use strict';
  const trigger=document.getElementById('aboutOpen'),dialog=document.getElementById('aboutDialog'),close=document.getElementById('aboutClose');
  if(!trigger||!dialog||!close)return;
  trigger.addEventListener('click',()=>{if(!dialog.open){dialog.showModal();close.focus()}});
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>trigger.focus({preventScroll:true}));
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation()});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
  });
})();
