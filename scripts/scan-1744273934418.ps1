
      $deviceManager = new-object -com "WIA.DeviceManager"
      $device = $deviceManager.DeviceInfos.Item(1).Connect()
      $item = $device.Items.Item(1)
      $imageFile = $item.Transfer("{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}")
      $imageFile.SaveFile("C:\\DMS\\backend\\scans\\scan-1744273934418.jpg")
    