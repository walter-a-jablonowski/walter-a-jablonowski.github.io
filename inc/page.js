(function($) {
  "use strict"; // Start of use strict

  // Smooth scrolling using jQuery easing
  $('a.js-scroll-trigger[href*="#"]:not([href="#"])').click(function() {
    if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
      var target = $(this.hash);
      target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
      if (target.length) {
        $('html, body').animate({
          scrollTop: (target.offset().top - 56)
        }, 1000, "easeInOutExpo");
        return false;
      }
    }
  });

  // Closes responsive menu when a scroll trigger link is clicked
  $('.js-scroll-trigger').click(function() {
    $('.navbar-collapse').collapse('hide');
  });

  // Activate scrollspy to add active class to navbar items on scroll
  $('body').scrollspy({
    target: '#mainNav',
    offset: 56
  });


  // Addedd WAJ
  
  // Menu bg

  // Initial depending on width

  if( window.innerWidth <= 768)
    $("#mainNav").css("background-color" , "#212121");
  else
    $("#mainNav").css("background-color" , "#00000000");
  
  // On scroll

  $(window).scroll( function() {

    var scroll = $(window).scrollTop();

    if( window.innerWidth <= 768)  // Allways bg if low width
      
      $("#mainNav").css("background-color" , "#212121");
    
    else                           // or if scrolling down
      
      if( scroll > 50)
        $("#mainNav").css("background-color" , "#212121");
      else  $("#mainNav").css("background-color" , "#00000000");

  });
  
  // On resize depending on width
  
  $(window).resize( function() {

    if( window.innerWidth <= 768)
      $("#mainNav").css("background-color" , "#212121");
    else
      $("#mainNav").css("background-color" , "#00000000");
  });

})(jQuery); // End of use strict
