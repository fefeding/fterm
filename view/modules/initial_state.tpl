<script type="text/template" id="__INITIAL_STATE__">
    {{ data | dump | safe }}
</script>
<script type="text/template" id="__DEFAULTINITIAL_STATE__">
  {{ __DEFAULTINITIAL_STATE__ }}
</script>
<script>
  function __get_templateJson(id) {
    try { 
        var tag = document.getElementById(id);
        var obj = JSON.parse(tag.innerHTML);
        return obj;
    }
    catch (e) {    
      return null;
    }
  }
  var __INITIAL_STATE__ = __get_templateJson('__INITIAL_STATE__');
  if(!__INITIAL_STATE__) __INITIAL_STATE__ = __get_templateJson('__DEFAULTINITIAL_STATE__');        
</script>
