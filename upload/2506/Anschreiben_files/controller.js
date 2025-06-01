document.addEventListener('DOMContentLoaded', function()
{
  // Log file functionality

  const logTextarea = document.getElementById('log-entries');
  const saveLogBtn  = document.getElementById('save-log-btn');
  const logStatus   = document.getElementById('log-status');

  if( logTextarea )
  {
    fetch('ajax.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'action=loadLog'
    })
    .then(response => response.json())
    .then(data => {
      if( data.success ) {
        logTextarea.value = data.content;
      } else {
        console.error('Error loading log file:', data.message);
      }
    })
    .catch(error => {
      console.error('AJAX error:', error);
    });
  }

  if( saveLogBtn && logTextarea )
  {
    saveLogBtn.addEventListener('click', function() {
      const content = logTextarea.value;
      
      fetch('ajax.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=saveLog&content=${encodeURIComponent(content)}`
      })
      .then(response => response.json())
      .then(data => {
        if( data.success ) {
          if( logStatus ) {
            logStatus.textContent = 'Saved successfully';
            // Clear the status message after 3 seconds
            setTimeout(() => {
              logStatus.textContent = '';
            }, 3000);
          }
        } else {
          if( logStatus ) {
            logStatus.textContent = 'Error: ' + data.message;
          }
          console.error('Error saving log file:', data.message);
        }
      })
      .catch(error => {
        if( logStatus ) {
          logStatus.textContent = 'Error saving';
        }
        console.error('AJAX error:', error);
      });
    });
  }

  // Handle variant selection change
  
  const variantSelect = document.querySelector('select[name="variant"]');
  const textArea = document.querySelector('textarea[name="text"]');
  
  if( variantSelect && textArea )
  {
    variantSelect.addEventListener('change', function() {
      const selectedVariant = this.value;
      
      fetch('ajax.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=loadVariant&variant=${encodeURIComponent(selectedVariant)}`
      })
      .then(response => response.json())
      .then(data => {
        if( data.success )
          textArea.value = data.content;
        else
          console.error('Error loading variant:', data.message);
      })
      .catch(error => {
        console.error('AJAX error:', error);
      });
    });
  }

  // Cycle through position with arrow key

  const positionInput   = document.querySelector('input[name="position"]');
  const positionOptions = [
    "Bewerbung als ",
    "Initiativbewerbung"
  ];

  let positionIndex = 0;

  if( positionInput )
  {
    // find initial index
    positionIndex = positionOptions.indexOf(positionInput.value);
    if( positionIndex === -1) positionIndex = 0;

    positionInput.addEventListener('keydown', function(e) {
      
      if( e.key === 'ArrowUp' || e.key === 'ArrowDown')
      {
        e.preventDefault();
        
        if( e.key === 'ArrowUp')
          positionIndex = (positionIndex - 1 + positionOptions.length) % positionOptions.length;
        else
          positionIndex = (positionIndex + 1) % positionOptions.length;
        
        positionInput.value = positionOptions[positionIndex];
      }
    });
  }

  // Cycle through anrede with arrow key

  const anredeInput   = document.querySelector('input[name="anrede"]');
  const anredeOptions = [
    "Sehr geehrte Damen und Herren",
    "Sehr geehrte Frau ",
    "Sehr geehrter Herr "
  ];

  let currentIndex = 0;

  if( anredeInput )
  {
    // find initial index
    currentIndex = anredeOptions.indexOf(anredeInput.value);
    if( currentIndex === -1) currentIndex = 0;

    anredeInput.addEventListener('keydown', function(e) {
      
      if( e.key === 'ArrowUp' || e.key === 'ArrowDown')
      {
        e.preventDefault();
        
        if( e.key === 'ArrowUp')
          currentIndex = (currentIndex - 1 + anredeOptions.length) % anredeOptions.length;
        else
          currentIndex = (currentIndex + 1) % anredeOptions.length;
        
        anredeInput.value = anredeOptions[currentIndex];
      }
    });
  }

  // Demo button functionality

  const demoButton = document.getElementById('demo-btn');
  if( demoButton )
  {
    demoButton.addEventListener('click', function() {

      // Fill address field with demo data
      const addressField = document.querySelector('textarea[name="address"]');
      if( addressField)
        addressField.value = "Demofirma GmbH\nPersonalabteilung\nMusterstraße 123\n12345 Musterstadt";
      
      // Fill position field with demo data
      const positionField = document.querySelector('input[name="position"]');
      if( positionField) {
        positionField.value = "Bewerbung als AI first Developer";
        // Update the position index if needed
        if (typeof positionIndex !== 'undefined') {
          const positionOptions = [
            "Bewerbung als ",
            "Initiativbewerbung"
          ];
          positionIndex = 0; // Set to first option
        }
      }
    });
  }
});
