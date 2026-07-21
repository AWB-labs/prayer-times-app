require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'WidgetBridge'
  s.version        = package['version'] || '1.0.0'
  s.summary        = 'Writes prayer data to the shared App Group and reloads WidgetKit timelines.'
  s.description    = 'Writes prayer data to the shared App Group and reloads WidgetKit timelines.'
  s.license        = 'MIT'
  s.author         = 'prayer-times-app'
  s.homepage       = 'https://github.com/Aliwael12/prayer-times-app'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
