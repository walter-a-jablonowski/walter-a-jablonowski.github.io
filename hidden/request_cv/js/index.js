// Form

let emailjsUser     = 'user_Eo1C4W8MfEJAIQvxUkVR4';
let emailjsService  = 'service_y1d8s4r';
let emailjsTemplate = 'template_t3eder2';

emailjs.init(emailjsUser);

// $('#contactForm input, textarea').change( function( event ) {  // no green borders
//   $('#contactForm').removeClass('was-validated');
// });

$('#contactForm').submit( function( event ) {

  event.preventDefault();


  // Verify

  let valid = $('#contactForm')[0].checkValidity();

  if( ! valid )
  {
    event.stopPropagation();

    $('#contactForm .invalid-feedback').show();  // simple solution, seems that BS cant do this

    return;
  }
  
  $('#contactForm .invalid-feedback').hide();
  // $('#contactForm').addClass('was-validated');


  // UI

  $('#sendTxt').text('Sending...').prop('disabled', true);
  $('#sendSpinner').show();


  // Send

  var args = {
    company: $('#company').val().trim(),
    mail:    $('#mail').val().trim(),
    message: $('#message').val().trim()
  };

  emailjs

    .send(emailjsService, emailjsTemplate, args)
    .then(

      function(response)
      {  
        $('#sendSpinner').hide();
        $('#sendTxt').text('Send').prop('disabled', false);

        $('#company').val('');
        $('#mail').val('');
        $('#message').val('');

        $('#sendMsg').text('Success !')
                     .fadeIn(500).delay(2000).fadeOut(1000);
      },
      
      function(error)
      {
        $('#sendSpinner').hide();
        $('#sendTxt').text('Send');

        $('#sendMsg').text('Error !')
                     .fadeIn(500).delay(2000).fadeOut(1000);
      }
    );
});
