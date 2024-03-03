import NavButton from './NavButton';
import './NavButton.css';

function Nav () {
  return (
    <div className='nav'>
      <NavButton label='USA' />
      <NavButton label='UK' />
    </div>
  )
}

export default Nav;